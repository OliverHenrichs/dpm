import { File } from "expo-file-system";
import { jobStore } from "@/src/anonymize/jobs/jobStore";
import {
  AnonymizeProvider,
  AnonymizeRequest,
} from "@/src/anonymize/providers/AnonymizeProvider";
import { runAnonymize } from "@/src/anonymize/runAnonymize";
import { releaseTranscriptionContexts } from "@/src/transcribe/transcribeVideo";

/**
 * Renders the first half second of an anonymization with the user's taps, so they can see
 * whether the silhouettes take before waiting minutes for the whole part (slower phones take
 * far longer). Not a job: nothing is kept, and the result is the caller's to throw away with
 * [discardPreview]. It still waits its turn with the jobs, since the phone cannot hold two
 * pipelines at once.
 */
export function previewAnonymize(
  provider: AnonymizeProvider,
  request: AnonymizeRequest,
  onProgress: (fraction: number) => void,
): Promise<string> {
  return jobStore.runExclusive(async () => {
    await releaseTranscriptionContexts();
    const { uri } = await runAnonymize(
      provider,
      request,
      ({ fraction }) => onProgress(fraction),
      undefined,
      { preview: true },
    );
    return uri;
  });
}

/** Best effort: a preview lives in the cache, which the OS clears anyway. */
export function discardPreview(uri: string) {
  try {
    new File(uri).delete();
  } catch {
    // a stray file in the cache costs only space
  }
}
