import { File } from "expo-file-system";
// The package's `exports` map has no root entry, only "./*": import its index explicitly.
import { initWhisper, WhisperContext } from "whisper.rn/index";
import { AudioExtractModule } from "@/modules/audio-extract";
import { ensureModel, WHISPER_MODEL } from "@/src/transcribe/modelStore";

export type TranscriptSegment = {
  /** Seconds from the start of the video. */
  start: number;
  end: number;
  text: string;
};

export type TranscribeOutcome = {
  language: string;
  model: string;
  segments: TranscriptSegment[];
  /** Spike measurements (L4): where the time went, and how fast against real time. */
  timing: {
    audioSeconds: number;
    extractMs: number;
    loadMs: number;
    transcribeMs: number;
    /** Audio seconds per wall-clock second of transcription; above 1 is faster than real time. */
    speed: number;
    gpu: boolean;
    /** whisper.cpp's reason when it fell back to the CPU. */
    noGpuReason?: string;
  };
};

export type TranscribeOptions = {
  /** ISO 639-1, or "auto" to detect. */
  language?: string;
  /** Initial prompt — see vocabularyPrompt. */
  prompt?: string;
  /** Longest stretch to transcribe, in seconds. */
  maxSeconds?: number;
  onProgress?: (fraction: number) => void;
};

let context: WhisperContext | null = null;
let contextGpu = false;
let contextNoGpuReason: string | undefined;

/** Loaded once and kept: loading the model costs about a second. */
async function whisper(): Promise<{ ctx: WhisperContext; loadMs: number }> {
  if (context) return { ctx: context, loadMs: 0 };
  const model = await ensureModel();
  const started = Date.now();
  context = await initWhisper({ filePath: model.uri });
  contextGpu = context.gpu;
  contextNoGpuReason = context.reasonNoGPU || undefined;
  return { ctx: context, loadMs: Date.now() - started };
}

/**
 * What is said in a local video, as timestamped segments. Transcribes the source's audio — L3's
 * silhouettes carry none, and the extractor rejects them with ERR_NO_AUDIO.
 */
export async function transcribeVideo(
  videoUri: string,
  {
    language = "auto",
    prompt,
    maxSeconds = 600,
    onProgress,
  }: TranscribeOptions = {},
): Promise<{ promise: Promise<TranscribeOutcome>; stop: () => Promise<void> }> {
  if (!AudioExtractModule)
    throw new Error("Transcription is not available on this device");

  const speech = await AudioExtractModule.extractSpeechWav(
    videoUri,
    maxSeconds,
  );
  const { ctx, loadMs } = await whisper();
  const started = Date.now();
  const { stop, promise } = ctx.transcribe(speech.uri, {
    language,
    prompt,
    onProgress: onProgress ? (percent) => onProgress(percent / 100) : undefined,
  });

  const done = promise
    .then((result) => {
      const transcribeMs = Date.now() - started;
      return {
        language: result.language,
        model: WHISPER_MODEL.id,
        // whisper.cpp reports segment times in centiseconds.
        segments: result.segments.map((s) => ({
          start: s.t0 / 100,
          end: s.t1 / 100,
          text: s.text.trim(),
        })),
        timing: {
          audioSeconds: speech.durationSeconds,
          extractMs: speech.elapsedMs,
          loadMs,
          transcribeMs,
          speed: speech.durationSeconds / Math.max(0.001, transcribeMs / 1000),
          gpu: contextGpu,
          noGpuReason: contextNoGpuReason,
        },
      };
    })
    .finally(() => {
      const wav = new File(speech.uri);
      if (wav.exists) wav.delete();
    });

  return { promise: done, stop };
}
