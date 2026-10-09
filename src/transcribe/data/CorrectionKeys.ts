/**
 * The storage key for a list's remembered transcript corrections (`corrections.ts`).
 *
 * Its own module, with no imports, for the reason `GraphLayoutKeys.ts` gives: `PatternListStorage`
 * deletes the key with its list, and must not pull the transcription code in to do it.
 */
export const TRANSCRIPT_CORRECTIONS_KEY_PREFIX = "@transcriptCorrections_";

export function getTranscriptCorrectionsKey(listId: string): string {
  return `${TRANSCRIPT_CORRECTIONS_KEY_PREFIX}${listId}`;
}
