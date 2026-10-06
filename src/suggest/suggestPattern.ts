import { Platform } from "react-native";
import * as Device from "expo-device";
import { isAudioExtractAvailable } from "@/modules/audio-extract";
import { MIN_DEVICE_MEMORY_BYTES } from "@/src/suggest/models";

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
