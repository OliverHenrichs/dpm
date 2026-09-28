import { initLlama, LlamaContext } from "llama.rn";
import { LlmSpec } from "@/src/suggest/llmModels";
import {
  parseSuggestion,
  Suggestion,
  SUGGESTION_SCHEMA,
  suggestionMessages,
} from "@/src/suggest/suggestPrompt";

/**
 * SPIKE (L4 suggestions): one model loaded at a time — two 1–3 GB models side by side would not
 * fit with the rest of the app — kept loaded between runs of the same model.
 */
let loaded: { id: string; context: LlamaContext; loadMs: number } | null = null;

export type SuggestOutcome = {
  suggestion: Suggestion | null;
  raw: string;
  loadMs: number;
  promptTokens: number;
  promptMs: number;
  outputTokens: number;
  outputPerSecond: number;
  totalMs: number;
  lib: string;
};

async function contextFor(model: LlmSpec, uri: string) {
  if (loaded?.id === model.id) return loaded;
  if (loaded) {
    await loaded.context.release();
    loaded = null;
  }
  const started = Date.now();
  const context = await initLlama({
    model: uri,
    n_ctx: 4096,
    use_mlock: false,
  });
  loaded = { id: model.id, context, loadMs: Date.now() - started };
  return loaded;
}

export async function releaseLlm() {
  if (loaded) await loaded.context.release();
  loaded = null;
}

export async function suggestPattern(
  model: LlmSpec,
  uri: string,
  input: { transcript: string; language: string; vocabulary: string[] },
): Promise<SuggestOutcome> {
  const started = Date.now();
  const { context, loadMs } = await contextFor(model, uri);
  const result = await context.completion({
    messages: suggestionMessages(
      input.transcript,
      input.language,
      input.vocabulary,
    ),
    jinja: true,
    enable_thinking: false,
    response_format: {
      type: "json_schema",
      json_schema: { strict: true, schema: SUGGESTION_SCHEMA },
    },
    n_predict: 256,
    temperature: 0.2,
  });
  return {
    suggestion: parseSuggestion(result.text),
    raw: result.text,
    loadMs,
    promptTokens: result.timings.prompt_n,
    promptMs: Math.round(result.timings.prompt_ms),
    outputTokens: result.timings.predicted_n,
    outputPerSecond: Math.round(result.timings.predicted_per_second * 10) / 10,
    totalMs: Date.now() - started,
    lib: context.androidLib ?? "",
  };
}
