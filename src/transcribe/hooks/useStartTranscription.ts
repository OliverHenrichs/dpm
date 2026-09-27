import { useDeidentifyJobs } from "@/src/deidentify/jobs/DeidentifyJobsContext";
import { useActivePatternList } from "@/src/pattern/data/components/ActivePatternListContext";
import { vocabularyPrompt } from "@/src/transcribe/vocabulary";

export type TranscriptionTarget = {
  listId: string;
  /** For the progress line; the job finds the video by [sourceUri]. */
  patternName: string;
  sourceUri: string;
};

/**
 * Starts a transcription job for a video, primed with the active list's own words (pattern
 * names, types, modifiers, tags) so Whisper hears "sugar push" rather than "sugar bush".
 * `language` is an ISO 639-1 code, or omitted to detect it.
 */
export function useStartTranscription() {
  const { activeList, patterns } = useActivePatternList();
  const { start } = useDeidentifyJobs();
  return (target: TranscriptionTarget, language?: string) => {
    const vocabulary = activeList ? vocabularyPrompt(activeList, patterns) : "";
    start({
      kind: "transcribe",
      listId: target.listId,
      patternName: target.patternName,
      request: {
        sourceUri: target.sourceUri,
        ...(language && { language }),
        ...(vocabulary && { vocabulary }),
      },
    });
  };
}
