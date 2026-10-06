import { useAnonymizeJobs } from "@/src/anonymize/jobs/AnonymizeJobsContext";
import { useActivePatternList } from "@/src/pattern/data/components/ActivePatternListContext";
import { patternWithVideo, vocabularyTerms } from "@/src/transcribe/vocabulary";
import { vocabularyFor } from "@/src/suggest/suggestPrompt";

export type TranscriptionTarget = {
  listId: string;
  /** For the progress line; the job finds the video by [sourceUri]. */
  patternName: string;
  sourceUri: string;
};

/**
 * Starts a transcription job for a video, primed with the active list's own words (the video's
 * pattern first, then the list's names, the dance's terms, types, modifiers, tags) so Whisper
 * hears "sugar push" rather than "sugar bush".
 * `language` is an ISO 639-1 code, or omitted to detect it. With `suggest`, the job goes on to
 * suggest a name and description from the transcript.
 */
export function useStartTranscription() {
  const { activeList, patterns } = useActivePatternList();
  const { start } = useAnonymizeJobs();
  return (
    target: TranscriptionTarget,
    language?: string,
    { suggest = false }: { suggest?: boolean } = {},
  ) => {
    const vocabulary = activeList
      ? vocabularyTerms(activeList, patterns, {
          name: target.patternName,
          pattern: patternWithVideo(patterns, target.sourceUri),
        })
      : [];
    start({
      kind: "transcribe",
      listId: target.listId,
      patternName: target.patternName,
      request: {
        sourceUri: target.sourceUri,
        ...(language && { language }),
        ...(vocabulary.length > 0 && { vocabulary }),
        ...(suggest && {
          suggest: { vocabulary: vocabularyFor(activeList, patterns) },
        }),
      },
    });
  };
}
