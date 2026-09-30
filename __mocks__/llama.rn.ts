/**
 * llama.rn, stood in for (L4 suggestions). The real package loads a native llama.cpp build that
 * does not exist under jest. This keeps the shape the app uses — `initLlama` giving a context with
 * `completion` and `release` — and lets a test decide what the model answers and see every call.
 */

type CompletionParams = {
  messages?: { role: string; content: string }[];
  response_format?: unknown;
  enable_thinking?: boolean;
  [key: string]: unknown;
};

let answer: (params: CompletionParams) => string | Error = () =>
  '{"teaches":false,"name":"","description":""}';

export const llamaCalls = {
  inits: [] as { model: string }[],
  completions: [] as CompletionParams[],
  releases: 0,
};

/** What the model answers; an Error makes the completion reject with it. */
export function setLlamaAnswer(
  fn: (params: CompletionParams) => string | Error,
): void {
  answer = fn;
}

export function resetLlamaMock(): void {
  answer = () => '{"teaches":false,"name":"","description":""}';
  llamaCalls.inits = [];
  llamaCalls.completions = [];
  llamaCalls.releases = 0;
}

export async function initLlama(params: { model: string }) {
  llamaCalls.inits.push({ model: params.model });
  return {
    androidLib: "mock",
    async completion(p: CompletionParams) {
      llamaCalls.completions.push(p);
      const text = answer(p);
      if (text instanceof Error) throw text;
      return {
        text,
        timings: {
          prompt_n: 1,
          prompt_ms: 1,
          predicted_n: 1,
          predicted_ms: 1,
          predicted_per_second: 1,
        },
      };
    },
    async release() {
      llamaCalls.releases++;
    },
  };
}
