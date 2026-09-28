/**
 * SPIKE (L4 suggestions, AGENT_TASKS.md): the small instruct models under comparison, all
 * ungated GGUF quantisations on Hugging Face that llama.rn 0.12.9 can load. Sizes are the exact
 * file sizes, which the store checks; hashes are left for the real feature.
 */
export type LlmSpec = {
  id: string;
  label: string;
  fileName: string;
  url: string;
  bytes: number;
  license: string;
  /** Qwen3.5 reasons before answering unless told not to; the others have no such mode. */
  thinks: boolean;
  /** Too big to ship; there to show what a larger model would add. */
  reference?: boolean;
};

const hf = (repo: string, file: string) =>
  `https://huggingface.co/${repo}/resolve/main/${file}`;

export const LLM_MODELS: LlmSpec[] = [
  {
    id: "qwen3.5-0.8b",
    label: "Qwen3.5 0.8B Q4_K_M",
    fileName: "Qwen3.5-0.8B-Q4_K_M.gguf",
    url: hf("unsloth/Qwen3.5-0.8B-GGUF", "Qwen3.5-0.8B-Q4_K_M.gguf"),
    bytes: 532_517_120,
    license: "Apache-2.0",
    thinks: true,
  },
  {
    id: "gemma3-1b",
    label: "Gemma 3 1B Q4_K_M",
    fileName: "gemma-3-1b-it-Q4_K_M.gguf",
    url: hf("ggml-org/gemma-3-1b-it-GGUF", "gemma-3-1b-it-Q4_K_M.gguf"),
    bytes: 806_058_240,
    license: "Gemma terms",
    thinks: false,
  },
  {
    id: "qwen3.5-2b",
    label: "Qwen3.5 2B Q4_K_M",
    fileName: "Qwen3.5-2B-Q4_K_M.gguf",
    url: hf("unsloth/Qwen3.5-2B-GGUF", "Qwen3.5-2B-Q4_K_M.gguf"),
    bytes: 1_280_835_840,
    license: "Apache-2.0",
    thinks: true,
  },
  {
    id: "gemma4-e2b",
    label: "Gemma 4 E2B Q4_0 (reference)",
    fileName: "gemma-4-E2B-it-Q4_0.gguf",
    url: hf("ggml-org/gemma-4-E2B-it-GGUF", "gemma-4-E2B-it-Q4_0.gguf"),
    bytes: 2_841_481_184,
    license: "Apache-2.0",
    thinks: false,
    reference: true,
  },
];
