// Web has no whisper.cpp; see whisper.ts. Same shape, and every call refuses.
import type {
  initWhisper as InitWhisper,
  initWhisperVad as InitWhisperVad,
} from "whisper.rn/index";

export type { WhisperContext, WhisperVadContext } from "whisper.rn/index";

const unavailable = () =>
  Promise.reject(new Error("Transcription is not available on the web"));

export const initWhisper: typeof InitWhisper = unavailable;
export const initWhisperVad: typeof InitWhisperVad = unavailable;
