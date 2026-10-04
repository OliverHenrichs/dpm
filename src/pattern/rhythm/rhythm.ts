import type { Dance } from "@/src/pattern/types/Dance";

/**
 * A pattern's rhythm, written the way dancers count it: one token per step, separated by spaces.
 *
 * - `3` — a step on beat 3.
 * - `3&4` or `3a4` — a triple: three steps over beats 3 and 4.
 * - `(4)` — beat 4 with no change of weight: a tap or a pause, as on 4 and 8 in salsa and
 *   bachata.
 *
 * The beats run from 1 without gaps, so a rhythm says how many counts it takes, and a pattern's
 * rhythm always matches its counts (see `EditPatternForm`): typing a rhythm sets the counts,
 * and changing the counts clears a rhythm that no longer fits.
 */

const TOKEN = /^(?:(\d+)|\((\d+)\)|(\d+)[&a](\d+))$/;

/** How many counts a rhythm takes, or null when it is not one. */
export function rhythmCounts(rhythm: string): number | null {
  const tokens = rhythm.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;
  let expected = 1;
  for (const token of tokens) {
    const match = TOKEN.exec(token);
    if (!match) return null;
    const [, step, held, from, to] = match;
    const beats = from ? [from, to] : [step ?? held];
    for (const beat of beats) {
      if (Number(beat) !== expected) return null;
      expected += 1;
    }
  }
  return expected - 1;
}

export function rhythmMatchesCounts(rhythm: string, counts: number): boolean {
  return rhythmCounts(rhythm) === counts;
}

/** Tidies the spacing, so equal rhythms compare equal. */
export function normalizeRhythm(rhythm: string): string {
  return rhythm.trim().split(/\s+/).join(" ");
}

/**
 * The basic rhythms of each dance, by counts. Only what is standard for the dance; anything
 * else is a plain step on every beat.
 *
 * - West Coast Swing and Lindy Hop: six-count patterns are walk walk, triple, triple (in Lindy,
 *   rock step, triple, triple); eight-count patterns, such as the whip or the swing out, put
 *   two more steps before the last triple.
 * - Salsa and bachata: eight counts, three steps and a pause or tap on 4 and 8.
 * - Argentine tango has no fixed count pattern, so it gets only the plain suggestion.
 */
const DANCE_RHYTHMS: Record<Dance, Record<number, string[]>> = {
  wcs: { 6: ["1 2 3&4 5&6"], 8: ["1 2 3&4 5 6 7&8"] },
  lindy: { 6: ["1 2 3&4 5&6"], 8: ["1 2 3&4 5 6 7&8"] },
  salsa: { 8: ["1 2 3 (4) 5 6 7 (8)"] },
  bachata: { 8: ["1 2 3 (4) 5 6 7 (8)"] },
  tango: {},
};

/** The longest plain rhythm offered; past this, counting each beat helps no one. */
const MAX_PLAIN_COUNTS = 16;

/** Rhythms that fit `counts`: the dance's own first, then a step on every beat. */
export function rhythmSuggestions(
  dance: Dance | undefined,
  counts: number,
): string[] {
  const own = dance ? (DANCE_RHYTHMS[dance][counts] ?? []) : [];
  const plain =
    Number.isInteger(counts) && counts > 0 && counts <= MAX_PLAIN_COUNTS
      ? [Array.from({ length: counts }, (_, i) => i + 1).join(" ")]
      : [];
  return [...own, ...plain];
}

/** The rhythm a template pattern starts with: the dance's own, when it has one. */
export function defaultRhythm(
  dance: Dance | undefined,
  counts: number,
): string | undefined {
  return dance ? DANCE_RHYTHMS[dance][counts]?.[0] : undefined;
}
