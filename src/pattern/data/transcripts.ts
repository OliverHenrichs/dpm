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
 * start. Shortening and anonymizing both cut a window out of the video; carried over whole, the
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

/**
 * The transcript with the line at [index] corrected to [text] by hand: the model mishears dance
 * slang ("sugar bush", "whipped"). A line corrected to nothing is removed. Times stay as they
 * were, so the line still plays from where it was said.
 */
export function correctTranscriptLine(
  transcript: IVideoTranscript,
  index: number,
  text: string,
  now: number = Date.now(),
): IVideoTranscript {
  const segment = transcript.segments[index];
  const corrected = text.trim();
  if (!segment || corrected === segment.text) return transcript;
  return {
    ...transcript,
    editedAt: now,
    segments: corrected
      ? transcript.segments.map((s, i) =>
          i === index ? { ...s, text: corrected } : s,
        )
      : transcript.segments.filter((_, i) => i !== index),
  };
}

/**
 * Puts a finished transcription on a video, unless the video already holds this one or a later
 * one. A job's update is applied again to every draft saved later in the session
 * (`applyReplacements`), and must not put the model's words back over the user's corrections.
 */
export const withTranscript =
  (transcript: IVideoTranscript) =>
  (ref: IVideoReference): IVideoReference =>
    ref.transcript && ref.transcript.createdAt >= transcript.createdAt
      ? ref
      : { ...ref, transcript };

/** The pattern with [transcript] on the video at [uri], wherever it holds it. */
export function setVideoTranscript<
  T extends Pick<IPattern, "videoRefs" | "modifierRefs">,
>(pattern: T, uri: string, transcript: IVideoTranscript): T {
  const set = (refs: IVideoReference[]) =>
    refs.map((ref) => (ref.value === uri ? { ...ref, transcript } : ref));
  return {
    ...pattern,
    videoRefs: set(pattern.videoRefs ?? []),
    modifierRefs: (pattern.modifierRefs ?? []).map((m) => ({
      ...m,
      videoRefs: set(m.videoRefs),
    })),
  };
}
