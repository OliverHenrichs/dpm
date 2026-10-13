import { jobStore } from "@/src/anonymize/jobs/jobStore";
import {
  AnonymizeProvider,
  DancerOutline,
  OutlineRequest,
} from "@/src/anonymize/providers/AnonymizeProvider";
import { discardPreview } from "@/src/anonymize/previewAnonymize";
import { releaseTranscriptionContexts } from "@/src/transcribe/transcribeVideo";

/**
 * Highlights who the taps picked on the tap frame (`AnonymizeProvider.outline`), so the user can
 * check before the full render. Not a job, like the preview: nothing is kept, and the image is
 * the caller's to throw away with [discardOutline]. It waits its turn with the jobs, since it
 * loads the tracking model. Never for a provider that sends footage off the device.
 */
export function outlineDancers(
  provider: AnonymizeProvider,
  request: OutlineRequest,
): Promise<DancerOutline> {
  const outline = provider.outline?.bind(provider);
  if (!outline || provider.sendsFootageOffDevice) {
    return Promise.reject(
      new Error(`Provider "${provider.id}" cannot outline on the device`),
    );
  }
  return jobStore.runExclusive(async () => {
    await releaseTranscriptionContexts();
    return outline(request);
  });
}

/** Best effort, like a preview: the image lives in the cache. */
export const discardOutline = discardPreview;
