/**
 * The models transcription needs, downloaded on first use (AGENT_TASKS.md, L4). Hashes are the
 * SHA-256 values Hugging Face publishes for the files (the LFS objects' etags).
 */
export type ModelSpec = {
  id: string;
  fileName: string;
  url: string;
  bytes: number;
  sha256: string;
};

/** Whisper base, multilingual, 5-bit quantised (MIT). */
export const WHISPER_MODEL: ModelSpec = {
  id: "whisper-base-q5_1",
  fileName: "ggml-base-q5_1.bin",
  url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base-q5_1.bin",
  bytes: 59_707_625,
  sha256: "422f1ae452ade6f30a004d7e5c6a43195e4433bc370bf23fac9cc591f01a8898",
};

/** Silero voice-activity detection for whisper.cpp (MIT): finds the stretches with speech. */
export const VAD_MODEL: ModelSpec = {
  id: "silero-v6.2.0",
  fileName: "ggml-silero-v6.2.0.bin",
  url: "https://huggingface.co/ggml-org/whisper-vad/resolve/main/ggml-silero-v6.2.0.bin",
  bytes: 885_098,
  sha256: "2aa269b785eeb53a82983a20501ddf7c1d9c48e33ab63a41391ac6c9f7fb6987",
};

export const TRANSCRIPTION_MODELS: ModelSpec[] = [WHISPER_MODEL, VAD_MODEL];

/** What the whole download costs, for telling the user before it starts. */
export const TRANSCRIPTION_DOWNLOAD_BYTES = TRANSCRIPTION_MODELS.reduce(
  (sum, m) => sum + m.bytes,
  0,
);

/** The download in whole megabytes, for the size notice. */
export const TRANSCRIPTION_DOWNLOAD_MB = Math.round(
  TRANSCRIPTION_DOWNLOAD_BYTES / 1_000_000,
);
