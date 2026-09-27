/**
 * whisper.rn, stood in for (L4). The real package ships untranspiled TypeScript and a JSI
 * native side, neither of which loads under jest. This keeps its shape — contexts with
 * `transcribe` / `detectSpeech` — and lets a test decide what the voice detector finds and what
 * each transcription returns, and see every call made.
 */

type Segment = { t0: number; t1: number; text: string };
type TranscribeOptions = {
  language?: string;
  prompt?: string;
  offset?: number;
  duration?: number;
  onProgress?: (percent: number) => void;
};
type TranscribeResult = {
  result: string;
  language: string;
  segments: Segment[];
  isAborted: boolean;
};

let vadSegments: { t0: number; t1: number }[] = [];
let answer: (
  options: TranscribeOptions,
  call: number,
) => TranscribeResult = () => ({
  result: "",
  language: "en",
  segments: [],
  isAborted: false,
});

export const whisperCalls = {
  initWhisper: 0,
  initVad: 0,
  transcribe: [] as { path: string; options: TranscribeOptions }[],
  stops: 0,
};

/** What voice-activity detection reports, in centiseconds, as whisper.cpp does. */
export function setVadSegments(segments: { t0: number; t1: number }[]): void {
  vadSegments = segments;
}

/** What each transcribe call returns; `call` counts from 0. */
export function setTranscribeResult(
  fn: (options: TranscribeOptions, call: number) => TranscribeResult,
): void {
  answer = fn;
}

export function resetWhisperMock(): void {
  vadSegments = [];
  answer = () => ({
    result: "",
    language: "en",
    segments: [],
    isAborted: false,
  });
  whisperCalls.initWhisper = 0;
  whisperCalls.initVad = 0;
  whisperCalls.transcribe = [];
  whisperCalls.stops = 0;
}

export async function initWhisper(_options: { filePath: string }) {
  whisperCalls.initWhisper++;
  return {
    gpu: false,
    reasonNoGPU: "Mock",
    transcribe(path: string, options: TranscribeOptions) {
      const call = whisperCalls.transcribe.length;
      whisperCalls.transcribe.push({ path, options });
      options.onProgress?.(100);
      return {
        stop: async () => {
          whisperCalls.stops++;
        },
        promise: Promise.resolve(answer(options, call)),
      };
    },
  };
}

export async function initWhisperVad(_options: { filePath: string }) {
  whisperCalls.initVad++;
  return {
    detectSpeech: async (_path: string) => vadSegments,
  };
}
