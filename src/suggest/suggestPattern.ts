import { Platform } from "react-native";
import * as Device from "expo-device";
import { isAudioExtractAvailable } from "@/modules/audio-extract";
import { jobStore } from "@/src/anonymize/jobs/jobStore";
import { installedModelUri } from "@/src/transcribe/modelStore";
import {
  MIN_DEVICE_MEMORY_BYTES,
  SUGGESTION_MODEL,
} from "@/src/suggest/models";
import { Suggestion } from "@/src/suggest/suggestPrompt";
import {
  runSuggestion,
  SuggestInput,
  SuggestionModelMissingError,
  SuggestPhase,
} from "@/src/suggest/runSuggestion";

export {
  runSuggestion,
  SuggestionModelMissingError,
  SuggestionUnreadableError,
} from "@/src/suggest/runSuggestion";
export type { SuggestInput, SuggestPhase } from "@/src/suggest/runSuggestion";

/**
 * Whether this phone can make suggestions: Android (the model's hash is checked natively, like
 * the speech model's) with enough memory for a 2B model beside the app.
 */
export function canSuggest(): boolean {
  return (
    Platform.OS === "android" &&
    isAudioExtractAvailable &&
    (Device.totalMemory ?? 0) >= MIN_DEVICE_MEMORY_BYTES
  );
}

/**
 * [runSuggestion] in turn with the video jobs, never beside Whisper or the silhouette pipeline:
 * the model would not fit in memory next to them. Reports "waiting" until its turn comes.
 */
export async function suggestPattern(
  input: SuggestInput,
  onPhase?: (phase: SuggestPhase) => void,
): Promise<Suggestion> {
  if (!installedModelUri(SUGGESTION_MODEL)) {
    throw new SuggestionModelMissingError();
  }
  onPhase?.("waiting");
  return jobStore.runExclusive(() => runSuggestion(input, onPhase));
}
