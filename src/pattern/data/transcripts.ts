import {
  IPattern,
  IVideoReference,
  IVideoTranscript,
} from "@/src/pattern/types/IPatternList";

/**
 * A video reference without its transcript. Transcripts stay on the device: exporting or
 * publishing a list must not carry what a teacher said off-hand to whoever receives it (L4).
 */
export function withoutTranscript(ref: IVideoReference): IVideoReference {
  if (!ref.transcript) return ref;
  const { transcript: _dropped, ...rest } = ref;
  return rest;
}

/** A pattern with every transcript removed — its own videos and its modifier combinations'. */
export function withoutTranscripts<
  T extends Pick<IPattern, "videoRefs" | "modifierRefs">,
>(pattern: T): T {
  return {
    ...pattern,
    videoRefs: (pattern.videoRefs ?? []).map(withoutTranscript),
    modifierRefs: (pattern.modifierRefs ?? []).map((m) => ({
      ...m,
      videoRefs: m.videoRefs.map(withoutTranscript),
    })),
  };
}

/** Whether any of these patterns has a transcript anywhere — its own videos or a combination's. */
export function hasTranscripts(
  patterns: Pick<IPattern, "videoRefs" | "modifierRefs">[],
): boolean {
  return patterns.some(
    (p) =>
      (p.videoRefs ?? []).some((v) => v.transcript) ||
      (p.modifierRefs ?? []).some((m) => m.videoRefs.some((v) => v.transcript)),
  );
}

/**
 * The transcript of a cut: the lines said within [start, end) of the source, timed from the cut's
 * start. Shortening and de-identifying both cut a window out of the video; carried over whole, the
 * transcript kept lines from outside it, at the source's times — past the end of the new clip.
 */
export function trimTranscript(
  transcript: IVideoTranscript,
  start: number,
  end: number,
): IVideoTranscript {
  return {
    ...transcript,
    segments: transcript.segments
      .filter((s) => s.end > start && s.start < end)
      .map((s) => ({
        ...s,
        start: Math.max(s.start, start) - start,
        end: Math.min(s.end, end) - start,
      })),
  };
}
