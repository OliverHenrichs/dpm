import { IVideoTranscript } from "@/src/pattern/types/IPatternList";

/**
 * A fix the user made to a transcript line, remembered for the list: "sugar bush" → "sugar
 * push". Whisper gets a dance's slang wrong the same way every time, so a fix made once is
 * applied to every later transcript of the list, and its corrected words join Whisper's prompt.
 */
export type TranscriptCorrection = { from: string; to: string };

/** Longer edits are rewrites of what was said, not a misheard word, and are not learned. */
const MAX_CORRECTION_WORDS = 4;
/** Kept per list, newest first; old fixes fall off the end. */
export const MAX_CORRECTIONS = 100;

/**
 * The misheard words fixed by an edit of one line: each run of changed words, when both sides
 * are short. Case and punctuation alone are not a fix of a word, and deleting or adding words
 * teaches nothing to replace.
 */
export function correctionsFromEdit(
  before: string,
  after: string,
): TranscriptCorrection[] {
  const a = words(before);
  const b = words(after);
  const corrections: TranscriptCorrection[] = [];
  for (const [fromWords, toWords] of changedRuns(a.map(key), b.map(key))) {
    if (fromWords.length === 0 || toWords.length === 0) continue;
    if (
      fromWords.length > MAX_CORRECTION_WORDS ||
      toWords.length > MAX_CORRECTION_WORDS
    ) {
      continue;
    }
    const from = fromWords.map((i) => key(a[i])).join(" ");
    const to = toWords.map((i) => bare(b[i])).join(" ");
    if (!from || !to || from === to.toLowerCase()) continue;
    corrections.push({ from, to });
  }
  return corrections;
}

/**
 * The remembered corrections with new ones added: newest first, one per misheard phrase. An edit
 * that undoes a remembered correction (a "push" put back to "bush") forgets it rather than
 * learning the reverse, which would turn every later "push" into "bush".
 */
export function mergeCorrections(
  existing: TranscriptCorrection[],
  added: TranscriptCorrection[],
): TranscriptCorrection[] {
  let merged = existing;
  for (const correction of added) {
    const undoes = (c: TranscriptCorrection) =>
      c.from === correction.to.toLowerCase() &&
      c.to.toLowerCase() === correction.from;
    if (merged.some(undoes)) {
      merged = merged.filter((c) => !undoes(c));
      continue;
    }
    merged = [correction, ...merged.filter((c) => c.from !== correction.from)];
  }
  return merged.slice(0, MAX_CORRECTIONS);
}

/**
 * The text with each remembered phrase replaced, as whole words and whatever its case; the
 * punctuation around a phrase is kept. Longer phrases are tried first, so "sugar bush" wins over
 * a separate fix of "bush".
 */
export function applyCorrections(
  text: string,
  corrections: TranscriptCorrection[],
): string {
  if (corrections.length === 0) return text;
  const byLength = [...corrections].sort(
    (x, y) => y.from.split(" ").length - x.from.split(" ").length,
  );
  const tokens = text.split(/(\s+)/);
  // Words sit at even indices, the whitespace between them at odd ones.
  const wordAt = (i: number) => key(tokens[2 * i] ?? "");
  const count = Math.ceil(tokens.length / 2);
  const out: string[] = [];
  let i = 0;
  while (i < count) {
    const match = byLength.find((c) => {
      const phrase = c.from.split(" ");
      return phrase.every((w, k) => i + k < count && wordAt(i + k) === w);
    });
    if (!match) {
      out.push(tokens[2 * i]);
      if (2 * i + 1 < tokens.length) out.push(tokens[2 * i + 1]);
      i++;
      continue;
    }
    const n = match.from.split(" ").length;
    const first = tokens[2 * i];
    const last = tokens[2 * (i + n - 1)];
    out.push(leading(first) + match.to + trailing(last));
    const after = 2 * (i + n - 1) + 1;
    if (after < tokens.length) out.push(tokens[after]);
    i += n;
  }
  return out.join("");
}

/** A transcript with the corrections applied to every line. */
export function applyLearnedCorrections(
  transcript: IVideoTranscript,
  corrections: TranscriptCorrection[],
): IVideoTranscript {
  if (corrections.length === 0) return transcript;
  return {
    ...transcript,
    segments: transcript.segments.map((s) => ({
      ...s,
      text: applyCorrections(s.text, corrections),
    })),
  };
}

/**
 * The lines whose text an edit changed, as [before, after], paired by their times: a correction
 * keeps a line's times, and a removed line has no partner, which teaches nothing.
 */
export function editedLines(
  before: IVideoTranscript,
  after: IVideoTranscript,
): [string, string][] {
  return after.segments.flatMap((line) => {
    const old = before.segments.find(
      (s) => s.start === line.start && s.end === line.end,
    );
    return old && old.text !== line.text
      ? [[old.text, line.text] as [string, string]]
      : [];
  });
}

function words(text: string): string[] {
  return text.split(/\s+/).filter((w) => bare(w) !== "");
}

/** A word without the punctuation around it. */
function bare(word: string): string {
  return word
    .replace(EDGE_PUNCTUATION_START, "")
    .replace(EDGE_PUNCTUATION_END, "");
}

/** How words are compared: bare and lower case. */
function key(word: string): string {
  return bare(word).toLowerCase();
}

function leading(word: string): string {
  return word.match(EDGE_PUNCTUATION_START)?.[0] ?? "";
}

function trailing(word: string): string {
  return word.match(EDGE_PUNCTUATION_END)?.[0] ?? "";
}

const EDGE_PUNCTUATION_START = /^[\s"'“”‘’«»¿¡([{.,;:!?…-]+/;
const EDGE_PUNCTUATION_END = /[\s"'“”‘’«»([{)\]}.,;:!?…-]+$/;

/**
 * The runs where two word sequences differ, as index lists into each, from a longest common
 * subsequence. Lines are short (`MAX_SEGMENT_CHARS`), so the quadratic table is small.
 */
function changedRuns(a: string[], b: string[]): [number[], number[]][] {
  const lcs: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i][j] =
        a[i] === b[j]
          ? lcs[i + 1][j + 1] + 1
          : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const runs: [number[], number[]][] = [];
  let run: [number[], number[]] = [[], []];
  const close = () => {
    if (run[0].length || run[1].length) runs.push(run);
    run = [[], []];
  };
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      close();
      i++;
      j++;
    } else if (
      j < b.length &&
      (i === a.length || lcs[i][j + 1] >= lcs[i + 1][j])
    ) {
      run[1].push(j++);
    } else {
      run[0].push(i++);
    }
  }
  close();
  return runs;
}
