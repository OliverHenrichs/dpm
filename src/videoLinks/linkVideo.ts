import { jobStore } from "@/src/anonymize/jobs/jobStore";
import { syncPublishedList } from "@/src/firebase/FirebaseListService";
import {
  getPatternListById,
  loadPatterns,
} from "@/src/pattern/data/PatternListStorage";
import { awaitingLink } from "@/src/videoLinks/awaitingLink";
import { linkedVideo } from "@/src/videoLinks/videoLinks";

/**
 * Whether a job still works on the video. Jobs find their video by URI, so swapping it for a
 * link under a running job would leave the result with nowhere to go.
 */
export function videoIsBusy(sourceUri: string): boolean {
  return jobStore
    .getJobs()
    .some(
      (j) =>
        j.sourceUri === sourceUri &&
        (j.status === "queued" ||
          j.status === "running" ||
          j.status === "review"),
    );
}

/**
 * Puts [url] in place of the local video at [sourceUri], wherever the list references it:
 * stored, in the mounted tree and in any open form's draft (`jobStore.updateVideo`). The video
 * keeps its transcript and provenance; the file itself stays where it is.
 *
 * A published list gets the link at once, the way `usePatternCrud` pushes an edit: unawaited,
 * and a failed push never fails the swap.
 */
export async function applyVideoLink(
  listId: string,
  sourceUri: string,
  url: string,
): Promise<void> {
  awaitingLink.clear(sourceUri);
  await jobStore.updateVideo(listId, sourceUri, (previous) =>
    previous.type === "local" ? linkedVideo(previous, url) : previous,
  );
  const list = await getPatternListById(listId);
  if (list?.shareCode && !list.readonly) {
    loadPatterns(listId)
      .then((patterns) => syncPublishedList(list, patterns))
      .catch(() => {});
  }
}
