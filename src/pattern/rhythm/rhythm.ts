import type { Dance } from "@/src/pattern/types/Dance";

/**
 * A pattern's rhythm, written the way dancers count it: one token per step, separated by spaces.
 *
 * - `3` — a step on beat 3.
 * - `3&4` or `3a4` — a triple: three steps over beats 3 and 4.
 * - `3&4&5`, `5a6a7` — a rolling count: consecutive beats chained with `&` or `a`, a step on
 *   each beat and on each `&` or `a` between them (the Telemark's `1 2 3&4&5 6`, review 2).
 *   Any number of beats can be chained; each counts once, so `3&4&5` takes three counts.
 * - `(4)` — beat 4 with no change of weight: a tap or a pause, as on 4 and 8 in salsa and
 *   bachata.
 *
 * The beats run from 1 without gaps, so a rhythm says how many counts it takes, and a pattern's
 * rhythm always matches its counts (see `EditPatternForm`): typing a rhythm sets the counts,
 * and changing the counts clears a rhythm that no longer fits.
 */

/** A step `3`, a held beat `(4)`, or two or more beats chained with `&` or `a`. */
const TOKEN = /^(?:(\d+)|\((\d+)\)|(\d+(?:[&a]\d+)+))$/;

/** The beats a token covers, in order, or null when it is not a token. */
function tokenBeats(token: string): number[] | null {
  const match = TOKEN.exec(token);
  if (!match) return null;
  const [, step, held, chain] = match;
  return chain ? chain.split(/[&a]/).map(Number) : [Number(step ?? held)];
}

/** How many counts a rhythm takes, or null when it is not one. */
export function rhythmCounts(rhythm: string): number | null {
  const tokens = rhythm.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;
  let expected = 1;
  for (const token of tokens) {
    const beats = tokenBeats(token);
    if (!beats) return null;
    for (const beat of beats) {
      if (beat !== expected) return null;
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
 * The basic rhythms of each dance, by counts, which a template's starter patterns begin with.
 * Only what is standard for the dance.
 *
 * - West Coast Swing and Lindy Hop: six-count patterns are walk walk, triple, triple (in Lindy,
 *   rock step, triple, triple); eight-count patterns, such as the whip or the swing out, put
 *   two more steps before the last triple. Each also swung, counted "3a4".
 * - Salsa and bachata: eight counts, three steps and a pause or tap on 4 and 8.
 * - Brazilian Zouk: slow, quick, quick ("boom, chick, chick"). Counted in half beats, the slow
 *   step falls on 1 and holds through 2, the quicks on 3 and 4; a basic, forward then back, takes
 *   two of those (Bath Zouk's move library, "Music & Rhythm").
 * - Argentine tango has no fixed count pattern, so it has none.
 */
const SWING: Record<number, string[]> = {
  6: ["1 2 3&4 5&6", "1 2 3a4 5a6"],
  8: ["1 2 3&4 5 6 7&8", "1 2 3a4 5 6 7a8"],
};
// Salsa and bachata figures often run over two bars of eight.
const LATIN: Record<number, string[]> = {
  8: ["1 2 3 (4) 5 6 7 (8)"],
  16: ["1 2 3 (4) 5 6 7 (8) 9 10 11 (12) 13 14 15 (16)"],
};
const ZOUK: Record<number, string[]> = {
  4: ["1 (2) 3 4"],
  8: ["1 (2) 3 4 5 (6) 7 8"],
};
const DANCE_RHYTHMS: Record<Dance, Record<number, string[]>> = {
  wcs: SWING,
  lindy: SWING,
  salsa: LATIN,
  bachata: LATIN,
  tango: {},
  zouk: ZOUK,
};

/**
 * The dance's basic rhythms for `counts`, offered while a pattern's rhythm field is empty: one
 * tap writes a whole rhythm. Nothing for a dance without one, or for counts it has none for.
 */
export function basicRhythms(
  dance: Dance | undefined,
  counts: number,
): string[] {
  return dance ? (DANCE_RHYTHMS[dance][counts] ?? []) : [];
}

/** The rhythm a template pattern starts with: the dance's own, when it has one. */
export function defaultRhythm(
  dance: Dance | undefined,
  counts: number,
): string | undefined {
  return dance ? DANCE_RHYTHMS[dance][counts]?.[0] : undefined;
}

/**
 * The steps that can follow what is written so far, for composing a rhythm a tap at a time: a
 * step, a triple (straight or swung) or a beat held, each starting on the next beat. Nothing
 * when what is written is not a rhythm, since no next beat follows from it.
 */
export function nextRhythmSteps(written: string): string[] {
  const counts = written.trim() ? rhythmCounts(written) : 0;
  if (counts === null) return [];
  const beat = counts + 1;
  return [`${beat}`, `${beat}&${beat + 1}`, `${beat}a${beat + 1}`, `(${beat})`];
}

/** `written` with one more step on the end. */
export function appendRhythmStep(written: string, step: string): string {
  const trimmed = written.trim();
  return trimmed ? `${trimmed} ${step}` : step;
}

/**
 * The link that rolls the last step on by one beat (`&5` after `3&4`, `a7` after `5a6`, in the
 * last link's own spelling), or `undefined` when the last step is not a chain of beats or what
 * is written is not a rhythm.
 */
export function nextChainLink(written: string): string | undefined {
  const counts = rhythmCounts(written);
  const last = written.trim().split(/\s+/).pop() ?? "";
  if (counts === null || !TOKEN.exec(last)?.[3]) return undefined;
  const joiner = /([&a])\d+$/.exec(last)?.[1] ?? "&";
  return `${joiner}${counts + 1}`;
}

/** `written` with `link` (from `nextChainLink`) joined onto its last step. */
export function appendChainLink(written: string, link: string): string {
  return `${written.trim()}${link}`;
}

/** The links of a chain past its first two beats: `3&4&5` → `&5`, else none. */
function trailingLink(token: string): string | undefined {
  if (!TOKEN.exec(token)?.[3]) return undefined;
  const links = token.match(/[&a]\d+/g) ?? [];
  return links.length > 1 ? links[links.length - 1] : undefined;
}

/**
 * What the undo takes off `written`: a rolled-on link (`&5` of `3&4&5`), so undo reverses the
 * extend; otherwise the whole last step. `undefined` when there is none.
 */
export function lastRhythmStep(written: string): string | undefined {
  const last = written.trim().split(/\s+/).filter(Boolean).pop();
  return last === undefined ? undefined : (trailingLink(last) ?? last);
}

/** `written` without what `lastRhythmStep` names: undoes the last tap, to fix a mistap. */
export function removeLastRhythmStep(written: string): string {
  const tokens = written.trim().split(/\s+/);
  const last = tokens.pop() ?? "";
  const link = trailingLink(last);
  if (link) tokens.push(last.slice(0, -link.length));
  return tokens.join(" ");
}
