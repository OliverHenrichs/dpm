import { IPattern, IVideoReference } from "@/src/pattern/types/IPatternList";

/**
 * What a finished job does to a video reference: replace it with a new one (a shortened or
 * de-identified video), or derive the new one from it (a transcript added to the same video).
 * The function form works on whatever reference is there at the time — including the copy in an
 * edit form's draft — so it keeps fields the job never saw.
 */
export type VideoUpdate =
  IVideoReference | ((current: IVideoReference) => IVideoReference);

export const applyUpdate = (update: VideoUpdate, ref: IVideoReference) =>
  typeof update === "function" ? update(ref) : update;

/**
 * Applies [update] to the video at [oldUri] wherever this pattern references it — its own
 * videos or a modifier combination's. Returns the same pattern object when nothing matched, so
 * callers can tell a no-op cheaply.
 */
export function replaceVideoInPattern(
  pattern: IPattern,
  oldUri: string,
  update: VideoUpdate,
): IPattern {
  let changed = false;
  const swap = (refs: IVideoReference[]) =>
    refs.map((ref) => {
      if (ref.value !== oldUri) return ref;
      changed = true;
      return applyUpdate(update, ref);
    });
  const videoRefs = swap(pattern.videoRefs);
  const modifierRefs = pattern.modifierRefs.map((m) => ({
    ...m,
    videoRefs: swap(m.videoRefs),
  }));
  return changed ? { ...pattern, videoRefs, modifierRefs } : pattern;
}

/** Whether [pattern] references the video at [uri] — its own, or a modifier combination's. */
export function patternHasVideo(
  pattern: Pick<IPattern, "videoRefs" | "modifierRefs">,
  uri: string,
): boolean {
  return (
    (pattern.videoRefs ?? []).some((v) => v.value === uri) ||
    (pattern.modifierRefs ?? []).some((m) =>
      m.videoRefs.some((v) => v.value === uri),
    )
  );
}

/**
 * Replacements made by finished jobs, old URI → new reference. An edit form that was open on
 * the pattern while its job finished still holds the old video in its draft; saving it would
 * put the original back. `usePatternCrud` runs every save through [applyReplacements].
 */
const replacements = new Map<string, VideoUpdate>();

export function recordReplacement(oldUri: string, update: VideoUpdate) {
  replacements.set(oldUri, update);
}

export function applyReplacements<
  T extends Pick<IPattern, "videoRefs" | "modifierRefs">,
>(pattern: T): T {
  if (replacements.size === 0) return pattern;
  let result = pattern;
  for (const [oldUri, update] of replacements) {
    result = replaceVideoInPattern(
      result as unknown as IPattern,
      oldUri,
      update,
    ) as unknown as T;
  }
  return result;
}

/** Test hook. */
export function clearReplacements() {
  replacements.clear();
}
