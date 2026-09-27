import { ITranscriptSegment } from "@/src/pattern/types/IPatternList";

/**
 * Whisper marks what is not speech with an annotation — "[MUSIC]", "*Music*", "(applause)" — as
 * a segment of its own. Those are not words anyone said.
 */
const ANNOTATION = /^\s*[[(*♪][^\])*]*[\])*♪]?\s*$/;

/**
 * Whisper's raw segments (centiseconds) as transcript segments (seconds): trimmed, annotations
 * and empty lines dropped, and runs of whitespace collapsed.
 */
export function toTranscriptSegments(
  raw: { t0: number; t1: number; text: string }[],
): ITranscriptSegment[] {
  return raw
    .map((s) => ({
      start: s.t0 / 100,
      end: s.t1 / 100,
      text: s.text.replace(/\s+/g, " ").trim(),
    }))
    .filter((s) => s.text.length > 0 && !ANNOTATION.test(s.text));
}

/** Longer than this, a line is too long to seek by: split it. */
export const MAX_SEGMENT_CHARS = 110;

/**
 * Splits segments longer than [maxChars] at sentence ends — or, failing that, at commas — and
 * shares the segment's time out by length. Whisper may return a long stretch as one segment
 * (the vocabulary prompt made 23 s one line in the L4 spike); tapping a line should seek near
 * what it says. The times are estimates within the segment, which is all seeking needs.
 */
export function splitLongSegments(
  segments: ITranscriptSegment[],
  maxChars = MAX_SEGMENT_CHARS,
): ITranscriptSegment[] {
  return segments.flatMap((segment) => {
    if (segment.text.length <= maxChars) return [segment];
    const pieces = splitText(segment.text, maxChars);
    if (pieces.length < 2) return [segment];
    const total = pieces.reduce((n, p) => n + p.length, 0);
    const span = segment.end - segment.start;
    let at = segment.start;
    return pieces.map((text, i) => {
      const end =
        i === pieces.length - 1
          ? segment.end
          : at + (span * text.length) / total;
      const piece = { start: at, end, text };
      at = end;
      return piece;
    });
  });
}

function splitText(text: string, maxChars: number): string[] {
  const sentences = text.match(/[^.!?…]+[.!?…]+["')\]]*\s*|[^.!?…]+$/g) ?? [
    text,
  ];
  const out: string[] = [];
  for (const sentence of sentences.map((s) => s.trim()).filter(Boolean)) {
    if (sentence.length <= maxChars) {
      pack(out, sentence, maxChars);
      continue;
    }
    for (const clause of sentence.split(/(?<=,)\s+/))
      pack(out, clause, maxChars);
  }
  return out;
}

/** Appends to the last piece while it stays within [maxChars], else starts a new one. */
function pack(out: string[], text: string, maxChars: number) {
  const last = out.at(-1);
  if (last && last.length + 1 + text.length <= maxChars) {
    out[out.length - 1] = `${last} ${text}`;
  } else {
    out.push(text);
  }
}
