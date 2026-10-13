import { jobStore } from "@/src/anonymize/jobs/jobStore";
import {
  AnonymizeProvider,
  DancerOutline,
  OutlineRequest,
} from "@/src/anonymize/providers/AnonymizeProvider";
import { discardPreview } from "@/src/anonymize/previewAnonymize";
import { releaseTranscriptionContexts } from "@/src/transcribe/transcribeVideo";

/**
 * Bumped by [releaseOutline], so a prepare or outline still queued behind a job when the taps
 * were left does not load the model again afterwards and hold it for nobody.
 */
let generation = 0;

const onDevice = (provider: AnonymizeProvider) =>
  !!provider.outline && !provider.sendsFootageOffDevice;

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
  if (!onDevice(provider)) {
    return Promise.reject(
      new Error(`Provider "${provider.id}" cannot outline on the device`),
    );
  }
  const mine = generation;
  return jobStore.runExclusive(async () => {
    if (mine !== generation) throw new Error("The taps were left");
    await releaseTranscriptionContexts();
    return provider.outline!(request);
  });
}

/**
 * Loads the model and encodes the tap frame as it opens, so the first tap answers in a moment
 * instead of seconds. Best effort: a tap prepares anyway if this failed.
 */
export function prepareOutline(
  provider: AnonymizeProvider,
  request: Omit<OutlineRequest, "prompts">,
): Promise<void> {
  if (!onDevice(provider) || !provider.prepareOutline) return Promise.resolve();
  const mine = generation;
  return jobStore
    .runExclusive(async () => {
      if (mine !== generation) return;
      await releaseTranscriptionContexts();
      await provider.prepareOutline!(request);
    })
    .catch(() => {});
}

/** Frees what [prepareOutline] and [outlineDancers] keep loaded, once the taps are done. */
export function releaseOutline(provider: AnonymizeProvider): Promise<void> {
  generation++;
  return (provider.releaseOutline?.() ?? Promise.resolve()).catch(() => {});
}

/** Best effort, like a preview: the image lives in the cache. */
export const discardOutline = discardPreview;
