import { IPattern, IVideoReference } from "@/src/pattern/types/IPatternList";

/**
 * Swaps the video at [oldUri] for [replacement] wherever this pattern references it — its own
 * videos or a modifier combination's. Returns the same pattern object when nothing matched, so
 * callers can tell a no-op cheaply.
 */
export function replaceVideoInPattern(
  pattern: IPattern,
  oldUri: string,
  replacement: IVideoReference,
): IPattern {
  let changed = false;
  const swap = (refs: IVideoReference[]) =>
    refs.map((ref) => {
      if (ref.value !== oldUri) return ref;
      changed = true;
      return replacement;
    });
  const videoRefs = swap(pattern.videoRefs);
  const modifierRefs = pattern.modifierRefs.map((m) => ({
    ...m,
    videoRefs: swap(m.videoRefs),
  }));
  return changed ? { ...pattern, videoRefs, modifierRefs } : pattern;
}

/**
 * Replacements made by finished jobs, old URI → new reference. An edit form that was open on
 * the pattern while its job finished still holds the old video in its draft; saving it would
 * put the original back. `usePatternCrud` runs every save through [applyReplacements].
 */
const replacements = new Map<string, IVideoReference>();

export function recordReplacement(
  oldUri: string,
  replacement: IVideoReference,
) {
  replacements.set(oldUri, replacement);
}

export function applyReplacements<
  T extends Pick<IPattern, "videoRefs" | "modifierRefs">,
>(pattern: T): T {
  if (replacements.size === 0) return pattern;
  let result = pattern;
  for (const [oldUri, replacement] of replacements) {
    result = replaceVideoInPattern(
      result as unknown as IPattern,
      oldUri,
      replacement,
    ) as unknown as T;
  }
  return result;
}

/** Test hook. */
export function clearReplacements() {
  replacements.clear();
}
