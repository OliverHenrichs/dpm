import { initLlama } from "@/src/suggest/llama";
import { installedModelUri } from "@/src/transcribe/modelStore";
import { SUGGESTION_MODEL } from "@/src/suggest/models";
import {
  parseSuggestion,
  Suggestion,
  SUGGESTION_SCHEMA,
  suggestionMessages,
} from "@/src/suggest/suggestPrompt";

export class SuggestionModelMissingError extends Error {
  constructor() {
    super("The suggestion model is not downloaded");
  }
}

/** The model could not produce an answer that reads as a suggestion. */
export class SuggestionUnreadableError extends Error {
  constructor(readonly raw: string) {
    super("The suggestion could not be read");
  }
}

export type SuggestInput = {
  /** What was said, as plain text. */
  transcript: string;
  /** ISO 639-1 code of the transcript, or "und". */
  language: string;
  /** The list's own names and terms, for spelling. */
  vocabulary: string[];
};

export type SuggestPhase = "waiting" | "loading" | "thinking";

/**
 * A suggested name and description for the pattern a transcript teaches, drafted by the model on
 * the phone. Empty fields mean the model found nothing taught. Loads the model for this one
 * answer only: holding ~3.4 GB between rare uses is not worth the few seconds a load takes.
 *
 * Runs whatever else is running, so only a job calls it, from inside its own turn in the queue
 * (`jobStore`: a suggest job, or a transcription that goes on to suggest).
 */
export async function runSuggestion(
  input: SuggestInput,
  onPhase?: (phase: SuggestPhase) => void,
): Promise<Suggestion> {
  const uri = installedModelUri(SUGGESTION_MODEL);
  if (!uri) throw new SuggestionModelMissingError();
  onPhase?.("loading");
  const context = await initLlama({ model: uri, n_ctx: 4096 });
  try {
    onPhase?.("thinking");
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
    const suggestion = parseSuggestion(result.text);
    if (!suggestion) throw new SuggestionUnreadableError(result.text);
    return suggestion;
  } finally {
    await context.release();
  }
}
