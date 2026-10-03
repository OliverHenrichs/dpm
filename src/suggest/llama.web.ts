// Web has no llama.cpp; see llama.ts. Same shape, and every call refuses.
import type { initLlama as InitLlama } from "llama.rn";

export const initLlama: typeof InitLlama = () =>
  Promise.reject(new Error("Suggestions are not available on the web"));
