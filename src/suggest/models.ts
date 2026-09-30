import { ModelSpec } from "@/src/transcribe/models";

/**
 * The model behind suggestions (L4, AGENT_TASKS.md): Qwen3.5 2B instruct, 4-bit (Apache-2.0).
 * The spike on the Pixel 10a chose it over Qwen3.5 0.8B, Gemma 3 1B and Gemma 4 E2B: right names,
 * summaries in its own words in English, German and Spanish, and nothing for clips that teach
 * nothing. Pinned to one commit of the repository, so the file cannot change under its hash.
 */
export const SUGGESTION_MODEL: ModelSpec = {
  id: "qwen3.5-2b-q4_k_m",
  fileName: "Qwen3.5-2B-Q4_K_M.gguf",
  url: "https://huggingface.co/unsloth/Qwen3.5-2B-GGUF/resolve/f6d5376be1edb4d416d56da11e5397a961aca8ae/Qwen3.5-2B-Q4_K_M.gguf",
  bytes: 1_280_835_840,
  sha256: "aaf42c8b7c3cab2bf3d69c355048d4a0ee9973d48f16c731c0520ee914699223",
};

export const SUGGESTION_DOWNLOAD_MB = Math.round(
  SUGGESTION_MODEL.bytes / 1_000_000,
);

/**
 * Suggestions are offered on phones with at least this much memory. The app peaked at 3.4 GB
 * with the model loaded on the Pixel 10a (8 GB); on a 4 GB phone Android would kill it.
 */
export const MIN_DEVICE_MEMORY_BYTES = 6 * 1024 ** 3;
