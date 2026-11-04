import {
  IPattern,
  ISequence,
  IVideoReference,
} from "@/src/pattern/types/IPatternList";
import { marksAfterCut } from "@/src/pattern/sequences/sequences";

/** How many videos a pattern, or one modifier combination of it, can hold. */
export const MAX_VIDEOS = 10;

/**
 * What a finished job does to a video reference: replace it with a new one (a shortened or
 * anonymized video), derive the new one from it (a transcript added to the same video), or
 * keep it and add the new one after it (both kept). The function form works on whatever
 * reference is there at the time — including the copy in an edit form's draft — so it keeps
 * fields the job never saw.
 */
export type VideoUpdate =
  | IVideoReference
  | ((current: IVideoReference) => IVideoReference | IVideoReference[]);

export const applyUpdate = (
  update: VideoUpdate,
  ref: IVideoReference,
): IVideoReference[] => {
  const result = typeof update === "function" ? update(ref) : update;
  return Array.isArray(result) ? result : [result];
};

/**
 * Applies [update] to the video at [oldUri] wherever this pattern references it — its own
 * videos or a modifier combination's. Returns the same pattern object when nothing matched, so
 * callers can tell a no-op cheaply.
 *
 * A video already in the same group is not added twice, and a group never grows past
 * [MAX_VIDEOS]: an update that keeps both is applied again on every later save of a draft (see
 * [applyReplacements]), and must change nothing the second time.
 */
export function replaceVideoInPattern(
  pattern: IPattern,
  oldUri: string,
  update: VideoUpdate,
): IPattern {
  let changed = false;
  const swap = (refs: IVideoReference[]) => {
    if (!refs.some((ref) => ref.value === oldUri)) return refs;
    const present = new Set(refs.map((ref) => ref.value));
    let room = MAX_VIDEOS - refs.length;
    const next = refs.flatMap((ref) => {
      if (ref.value !== oldUri) return [ref];
      const [first, ...added] = applyUpdate(update, ref);
      const fresh = added.filter((next) => {
        if (present.has(next.value) || room <= 0) return false;
        present.add(next.value);
        room--;
        return true;
      });
      return [first, ...fresh];
    });
    // An update already applied (a transcript added to the same video, both kept) yields the
    // same references again. Reporting that as a change made an open edit form treat every job
    // progress tick as a new set of videos.
    if (
      next.length === refs.length &&
      next.every((ref, i) => sameVideoRef(ref, refs[i]))
    ) {
      return refs;
    }
    changed = true;
    return next;
  };
  const videoRefs = swap(pattern.videoRefs);
  const modifierRefs = pattern.modifierRefs.map((m) => {
    const swapped = swap(m.videoRefs);
    return swapped === m.videoRefs ? m : { ...m, videoRefs: swapped };
  });
  return changed ? { ...pattern, videoRefs, modifierRefs } : pattern;
}

/**
 * The part of the original a cut kept, in seconds. A sequence's marks are places in its video,
 * so a video replaced by its cut moves them with it (`marksAfterCut`).
 */
export type Cut = { start: number; end: number };

/**
 * Applies [update] to the video at [oldUri] when it is this sequence's video. A sequence holds
 * one video, so only the update's first reference is kept: keeping both leaves the original,
 * and its marks, as they were. When the video is replaced by a [cut] of it, the marks move to
 * the kept part and those outside it go. Returns the same sequence object when nothing changed.
 */
export function replaceVideoInSequence(
  sequence: ISequence,
  oldUri: string,
  update: VideoUpdate,
  cut?: Cut,
): ISequence {
  const video = sequence.video;
  if (video?.value !== oldUri) return sequence;
  const [next] = applyUpdate(update, video);
  if (!next || sameVideoRef(next, video)) return sequence;
  const moved = cut && next.value !== oldUri;
  return {
    ...sequence,
    video: next,
    ...(moved && { steps: marksAfterCut(sequence.steps, cut.start, cut.end) }),
  };
}

/** [replaceVideoInSequence] over a list's sequences; the same array when none changed. */
export function replaceVideoInSequences(
  sequences: ISequence[] | undefined,
  oldUri: string,
  update: VideoUpdate,
  cut?: Cut,
): ISequence[] | undefined {
  if (!sequences) return sequences;
  const next = sequences.map((s) =>
    replaceVideoInSequence(s, oldUri, update, cut),
  );
  return next.some((s, i) => s !== sequences[i]) ? next : sequences;
}

/** The sequence whose video is the one at [uri], if any. */
export const sequenceWithVideo = (
  sequences: ISequence[] | undefined,
  uri: string,
): ISequence | undefined => sequences?.find((s) => s.video?.value === uri);

/** Whether two references hold the same fields, each the same value or object. */
function sameVideoRef(a: IVideoReference, b: IVideoReference): boolean {
  if (a === b) return true;
  const keys = Object.keys(a) as (keyof IVideoReference)[];
  return (
    keys.length === Object.keys(b).length && keys.every((k) => a[k] === b[k])
  );
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
 * Replacements made by finished jobs, old URI → new reference (and the cut, for a sequence's
 * marks). An edit form that was open on the pattern or sequence while its job finished still
 * holds the old video in its draft; saving it would put the original back. `usePatternCrud`
 * runs every save through [applyReplacements] or [applySequenceReplacements].
 */
const replacements = new Map<string, { update: VideoUpdate; cut?: Cut }>();

export function recordReplacement(
  oldUri: string,
  update: VideoUpdate,
  cut?: Cut,
) {
  replacements.set(oldUri, { update, cut });
}

export function applyReplacements<
  T extends Pick<IPattern, "videoRefs" | "modifierRefs">,
>(pattern: T): T {
  if (replacements.size === 0) return pattern;
  let result = pattern;
  for (const [oldUri, { update }] of replacements) {
    result = replaceVideoInPattern(
      result as unknown as IPattern,
      oldUri,
      update,
    ) as unknown as T;
  }
  return result;
}

/** [applyReplacements] for a sequence: its draft's video, and the marks a cut moves. */
export function applySequenceReplacements(sequence: ISequence): ISequence {
  let result = sequence;
  for (const [oldUri, { update, cut }] of replacements) {
    result = replaceVideoInSequence(result, oldUri, update, cut);
  }
  return result;
}

/** Test hook. */
export function clearReplacements() {
  replacements.clear();
}
