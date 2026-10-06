import { File } from "expo-file-system";
import { AudioExtractModule } from "@/modules/audio-extract";
import { IVideoTranscript } from "@/src/pattern/types/IPatternList";
import { installedModels } from "@/src/transcribe/modelStore";
import { SpeechRegion, speechRegions } from "@/src/transcribe/speechRegions";
import {
  initWhisper,
  initWhisperVad,
  WhisperContext,
  WhisperVadContext,
} from "@/src/transcribe/whisper";
import {
  splitLongSegments,
  toTranscriptSegments,
} from "@/src/transcribe/segments";

export type TranscribeOptions = {
  /** ISO 639-1; omitted to detect it. */
  language?: string;
  /** Whisper's initial prompt — see vocabularyPrompt. */
  prompt?: string;
  /** Longest stretch of the clip to transcribe, in seconds. */
  maxSeconds?: number;
  onProgress?: (fraction: number) => void;
};

export type TranscribeOutcome = {
  transcript: IVideoTranscript;
  /** Where the time went — for the dev log and for tuning. */
  timing: {
    audioSeconds: number;
    speechSeconds: number;
    regions: number;
    extractMs: number;
    transcribeMs: number;
    /** Whisper ran on the CPU; its reason, when it gives one. */
    noGpuReason?: string;
  };
};

export class ModelsMissingError extends Error {
  constructor() {
    super("The transcription models are not downloaded");
  }
}

/** Rejected with when the video has no sound at all — L3's silhouettes, for one. */
export class NoAudioError extends Error {
  constructor() {
    super("The video has no sound");
  }
}

// Loaded once and kept while transcribing: loading costs a fraction of a second, and a list is
// often transcribed a video at a time. A video job unloads them first; see
// releaseTranscriptionContexts.
let whisper: WhisperContext | null = null;
let vad: WhisperVadContext | null = null;
let whisperModelId: string | null = null;

/**
 * Beam search instead of whisper.cpp's greedy default: it weighs several readings of each stretch
 * before committing, which gets more words right and repeats phrases less, at some speed.
 */
const BEAM_SIZE = 5;

async function contexts() {
  const models = installedModels();
  if (!models) throw new ModelsMissingError();
  // A different Whisper model (the accurate one downloaded or deleted) means a fresh context.
  if (whisper && whisperModelId !== models.whisperModelId) {
    const stale = whisper;
    whisper = null;
    await stale.release().catch(() => undefined);
  }
  whisper ??= await initWhisper({ filePath: models.whisperUri });
  whisperModelId = models.whisperModelId;
  vad ??= await initWhisperVad({ filePath: models.vadUri });
  return { whisper, vad, modelId: models.whisperModelId };
}

/**
 * Unloads the models; the next transcription loads them again. The video jobs call this before
 * they start: Whisper keeps ~250 MB of native memory, which the silhouette pipeline needs
 * (measured on a Pixel 10a after a transcription, 2026-10-04).
 */
export async function releaseTranscriptionContexts() {
  const loaded = [whisper, vad];
  whisper = null;
  vad = null;
  whisperModelId = null;
  await Promise.all(
    loaded.map((context) => context?.release().catch(() => undefined)),
  );
}

/** Test hook: forget the loaded contexts. */
export function resetTranscriptionContexts() {
  whisper = null;
  vad = null;
  whisperModelId = null;
}

/** The longest stretch first, for language detection; the rest in their order in the clip. */
export function detectionOrder(regions: SpeechRegion[]): SpeechRegion[] {
  if (regions.length < 2) return regions;
  const longest = regions.reduce((a, b) =>
    b.end - b.start > a.end - a.start ? b : a,
  );
  return [longest, ...regions.filter((r) => r !== longest)];
}

/**
 * What is said in a local video, as a transcript. The work, in order:
 * 1. the audio track is decoded to the 16 kHz mono WAV whisper.cpp reads;
 * 2. voice-activity detection finds the stretches with speech — without it, music-only audio
 *    sent Whisper into slow retries (L4 spike: 3.5× → 0.9× real time with a prompt);
 * 3. Whisper transcribes each stretch. The language is detected on the longest, which goes
 *    first, and is then fixed, so one transcript is in one language and the other stretches skip
 *    detection; a short first stretch ("okay, so…") guessed the language badly;
 * 4. long lines are split so that a tap can seek near what it says.
 *
 * Returns at once; `stop` ends the work early and rejects the promise.
 */
export function transcribeVideo(
  videoUri: string,
  { language, prompt, maxSeconds = 600, onProgress }: TranscribeOptions = {},
): { promise: Promise<TranscribeOutcome>; stop: () => void } {
  let stopped = false;
  let stopCurrent: (() => Promise<void>) | null = null;

  const promise = (async (): Promise<TranscribeOutcome> => {
    if (!AudioExtractModule) {
      throw new Error("Transcription is not available on this device");
    }
    const { whisper, vad, modelId } = await contexts();

    let speech;
    try {
      speech = await AudioExtractModule.extractSpeechWav(videoUri, maxSeconds);
    } catch (e) {
      if (String(e).includes("no audio track")) throw new NoAudioError();
      throw e;
    }
    const wav = new File(speech.uri);
    try {
      onProgress?.(0.05);
      const regions = speechRegions(
        await vad.detectSpeech(speech.uri),
        speech.durationSeconds,
      );
      const speechSeconds = regions.reduce((n, r) => n + r.end - r.start, 0);
      onProgress?.(0.1);

      let lang = language ?? "auto";
      const raw: { t0: number; t1: number; text: string }[] = [];
      const started = Date.now();
      let doneSeconds = 0;
      for (const region of detectionOrder(regions)) {
        if (stopped) throw new Error("Transcription stopped");
        const regionSeconds = region.end - region.start;
        const { stop, promise: regionDone } = whisper.transcribe(speech.uri, {
          language: lang,
          prompt,
          beamSize: BEAM_SIZE,
          // Absolute: whisper.cpp starts at `offset` and reports times from the file's start.
          offset: Math.round(region.start * 1000),
          duration: Math.round(regionSeconds * 1000),
          onProgress: (percent) =>
            onProgress?.(
              0.1 +
                (0.9 * (doneSeconds + (regionSeconds * percent) / 100)) /
                  Math.max(speechSeconds, 0.001),
            ),
        });
        stopCurrent = stop;
        const result = await regionDone;
        stopCurrent = null;
        if (result.isAborted) throw new Error("Transcription stopped");
        if (lang === "auto" && result.language) lang = result.language;
        raw.push(...result.segments);
        doneSeconds += regionSeconds;
      }
      onProgress?.(1);

      return {
        transcript: {
          language: lang === "auto" ? "und" : lang,
          model: modelId,
          createdAt: Date.now(),
          segments: splitLongSegments(
            toTranscriptSegments(raw.sort((a, b) => a.t0 - b.t0)),
          ),
        },
        timing: {
          audioSeconds: speech.durationSeconds,
          speechSeconds,
          regions: regions.length,
          extractMs: speech.elapsedMs,
          transcribeMs: Date.now() - started,
          noGpuReason: whisper.gpu ? undefined : whisper.reasonNoGPU,
        },
      };
    } finally {
      if (wav.exists) wav.delete();
    }
  })();

  return {
    promise,
    stop: () => {
      stopped = true;
      void stopCurrent?.();
    },
  };
}
