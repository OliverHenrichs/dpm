import { ITranscriptSegment } from "@/src/pattern/types/IPatternList";

/**
 * The ticked lines of a transcript as one paragraph, in the order they were said — however
 * they were ticked.
 */
export function transcriptExcerpt(
  segments: ITranscriptSegment[],
  ticked: ReadonlySet<number>,
): string {
  return segments
    .map((segment, i) => ({ segment, i }))
    .filter(({ i }) => ticked.has(i))
    .sort((a, b) => a.segment.start - b.segment.start)
    .map(({ segment }) => segment.text.trim())
    .filter(Boolean)
    .join(" ");
}

/** Appends an excerpt as a paragraph of its own; the description stays the user's own text. */
export function appendToDescription(
  description: string,
  excerpt: string,
): string {
  const text = excerpt.trim();
  if (!text) return description;
  const before = description.trimEnd();
  return before ? `${before}\n\n${text}` : text;
}

/** The segment being said at `seconds`, or -1 between segments. */
export function segmentAt(
  segments: ITranscriptSegment[],
  seconds: number,
): number {
  return segments.findIndex((s) => seconds >= s.start && seconds < s.end);
}
