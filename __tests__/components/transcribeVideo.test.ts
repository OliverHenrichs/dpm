import { readFileBytes, seedBinaryFile } from "@/__mocks__/expo-file-system";
import {
  setTranscribeResult,
  setVadSegments,
  whisperCalls,
} from "@/__mocks__/whisper.rn/index";
import { AudioExtractModule } from "@/modules/audio-extract";
import { installedModels } from "@/src/transcribe/modelStore";
import {
  ModelsMissingError,
  NoAudioError,
  releaseTranscriptionContexts,
  resetTranscriptionContexts,
  transcribeVideo,
} from "@/src/transcribe/transcribeVideo";

jest.mock("@/modules/audio-extract", () => ({
  AudioExtractModule: { extractSpeechWav: jest.fn(), sha256File: jest.fn() },
}));
jest.mock("@/src/transcribe/modelStore", () => ({
  installedModels: jest.fn(),
}));

const VIDEO = "file:///document/video-teacher.mp4";
const WAV = "file:///cache/audio-extract/1-speech.wav";

const extract = AudioExtractModule!.extractSpeechWav as jest.Mock;
const models = installedModels as jest.Mock;

beforeEach(() => {
  resetTranscriptionContexts();
  models.mockReturnValue({
    whisperUri: "file:///document/models/w.bin",
    vadUri: "file:///document/models/v.bin",
  });
  extract.mockImplementation(async () => {
    seedBinaryFile(WAV, Buffer.from([0, 0]));
    return {
      uri: WAV,
      durationSeconds: 60,
      sourceSampleRate: 48000,
      sourceChannels: 2,
      elapsedMs: 5,
    };
  });
});

const run = (options = {}) => transcribeVideo(VIDEO, options).promise;

describe("transcribeVideo", () => {
  it("transcribes only the stretches with speech, at their place in the clip", async () => {
    // Speech at 10–14 s and 40–45 s, in the detector's centiseconds.
    setVadSegments([
      { t0: 1000, t1: 1400 },
      { t0: 4000, t1: 4500 },
    ]);
    setTranscribeResult((options) => ({
      result: "",
      language: "de",
      isAborted: false,
      segments: [
        {
          t0: (options.offset ?? 0) / 10,
          t1: (options.offset ?? 0) / 10 + 200,
          text: ` Satz bei ${options.offset}`,
        },
      ],
    }));

    const { transcript, timing } = await run();

    expect(whisperCalls.transcribe.map((c) => c.options.offset)).toEqual([
      9750, 39750,
    ]);
    expect(whisperCalls.transcribe.map((c) => c.options.duration)).toEqual([
      4500, 5500,
    ]);
    expect(transcript.segments).toEqual([
      { start: 9.75, end: 11.75, text: "Satz bei 9750" },
      { start: 39.75, end: 41.75, text: "Satz bei 39750" },
    ]);
    expect(timing.regions).toBe(2);
    expect(timing.speechSeconds).toBeCloseTo(10);
  });

  it("detects the language on the first stretch and keeps it for the rest", async () => {
    setVadSegments([
      { t0: 100, t1: 400 },
      { t0: 3000, t1: 3300 },
    ]);
    setTranscribeResult(() => ({
      result: "",
      language: "es",
      isAborted: false,
      segments: [],
    }));

    const { transcript } = await run();

    expect(whisperCalls.transcribe.map((c) => c.options.language)).toEqual([
      "auto",
      "es",
    ]);
    expect(transcript.language).toBe("es");
  });

  it("uses the language it is given, and the prompt", async () => {
    setVadSegments([{ t0: 100, t1: 400 }]);

    await run({ language: "de", prompt: "Sugar Push, Whip." });

    expect(whisperCalls.transcribe[0].options).toMatchObject({
      language: "de",
      prompt: "Sugar Push, Whip.",
    });
  });

  it("does not run Whisper at all when nothing is said", async () => {
    setVadSegments([]);

    const { transcript } = await run();

    expect(whisperCalls.transcribe).toHaveLength(0);
    expect(transcript.segments).toEqual([]);
    expect(transcript.language).toBe("und");
  });

  it("leaves out what is not speech", async () => {
    setVadSegments([{ t0: 100, t1: 400 }]);
    setTranscribeResult(() => ({
      result: "",
      language: "en",
      isAborted: false,
      segments: [
        { t0: 100, t1: 200, text: " [MUSIC]" },
        { t0: 200, t1: 400, text: " Step, step." },
      ],
    }));

    const { transcript } = await run();

    expect(transcript.segments.map((s) => s.text)).toEqual(["Step, step."]);
  });

  it("reports progress up to the end", async () => {
    setVadSegments([{ t0: 100, t1: 400 }]);
    const seen: number[] = [];

    await run({ onProgress: (f: number) => seen.push(f) });

    expect(seen.at(-1)).toBe(1);
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
  });

  it("deletes the extracted audio afterwards", async () => {
    setVadSegments([{ t0: 100, t1: 400 }]);

    await run();

    expect(readFileBytes(WAV)).toBeUndefined();
  });

  it("says when the video has no sound", async () => {
    extract.mockRejectedValue(
      new Error("Call rejected. Caused by: The video has no audio track"),
    );

    await expect(run()).rejects.toBeInstanceOf(NoAudioError);
  });

  it("says when the models are not downloaded, without extracting anything", async () => {
    models.mockReturnValue(null);

    await expect(run()).rejects.toBeInstanceOf(ModelsMissingError);
    expect(extract).not.toHaveBeenCalled();
  });

  it("stops before transcribing when asked to", async () => {
    setVadSegments([{ t0: 100, t1: 400 }]);

    const handle = transcribeVideo(VIDEO);
    handle.stop();

    await expect(handle.promise).rejects.toThrow("stopped");
    expect(whisperCalls.transcribe).toHaveLength(0);
  });

  it("loads the models once for many videos", async () => {
    setVadSegments([{ t0: 100, t1: 400 }]);

    await run();
    await run();

    expect(whisperCalls.initWhisper).toBe(1);
    expect(whisperCalls.initVad).toBe(1);
  });

  it("unloads the models when released, and loads them again when next needed", async () => {
    setVadSegments([{ t0: 100, t1: 400 }]);

    await run();
    await releaseTranscriptionContexts();
    expect(whisperCalls.releases).toBe(2);
    await releaseTranscriptionContexts(); // nothing loaded: nothing to do
    expect(whisperCalls.releases).toBe(2);

    await run();
    expect(whisperCalls.initWhisper).toBe(2);
  });
});
