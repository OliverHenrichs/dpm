import type { Dance } from "@/src/pattern/types/Dance";

/**
 * A pattern's rhythm, written the way dancers count it: one token per step group, separated by
 * spaces (src/pattern/rhythm/AGENTS.md has the table).
 *
 * - `3` — a step on beat 3.
 * - `3&4`, `3a4`, `3&a4` — steps between two beats: after a beat number come its subdivisions,
 *   `&` (the half) and `a` (the late offbeat), each at most once and `&` before `a`, and then
 *   the next beat in the same token. Any number of beats can be chained (`3&4&5`, the Telemark's
 *   rolling count, review 2); each beat counts once.
 * - `1 2 3&` — only the last token may end on a subdivision (a step on the & of 3). Elsewhere a
 *   subdivision always chains on to the next beat (`3&4`, never `3& 4`), so a rhythm has one
 *   spelling.
 * - `(4)`, `3(&)4`, `3&(a)4`, `3&(4)` — any single beat or subdivision held: no change of
 *   weight, a tap or a pause, as on 4 and 8 in salsa and bachata.
 *
 * The beats run from 1 without gaps, so a rhythm says how many counts it takes: the last beat
 * number (`1 2 3&` is 3). A pattern's rhythm always matches its counts (see `EditPatternForm`):
 * typing a rhythm sets the counts, and changing the counts clears a rhythm that no longer fits.
 *
 * A rhythm can instead be written in slows and quicks (`S Q Q`, issue #135): `S` takes two
 * counts and `Q` one, so its counts are in quicks. The notation is read from what is written;
 * the two never mix in one rhythm, and slows and quicks take no `&` or `a`. Lower case is read
 * too, and `normalizeRhythm` writes it in capitals.
 */

/** A subdivision of a beat: `&` the half, `a` the late offbeat. */
export type RhythmMark = "&" | "a";

/** One element of a counted rhythm: a beat number or a subdivision of the beat before it. */
export interface RhythmElement {
  value: number | RhythmMark;
  /** Danced without a change of weight, written in parentheses: `(4)`, `(&)`. */
  held: boolean;
}

/** One element, held or not; matched from the start of what is left of a token. */
const ELEMENT = /\((\d+|[&a])\)|(\d+|[&a])/y;

/** The elements of one token, in order, or null when it is not made of them. */
function tokenElements(token: string): RhythmElement[] | null {
  const elements: RhythmElement[] = [];
  ELEMENT.lastIndex = 0;
  while (ELEMENT.lastIndex < token.length) {
    const match = ELEMENT.exec(token);
    if (!match) return null;
    const text = match[1] ?? match[2];
    elements.push({
      value: text === "&" || text === "a" ? text : Number(text),
      held: match[1] !== undefined,
    });
  }
  return elements;
}

/** A slow or a quick, in either case. */
const SLOW_QUICK = /^[SQ]$/i;

const tokensOf = (rhythm: string) => rhythm.trim().split(/\s+/).filter(Boolean);

/** Whether `rhythm` is one written in slows and quicks (`S Q Q`). */
export function isSlowQuickRhythm(rhythm: string): boolean {
  const tokens = tokensOf(rhythm);
  return tokens.length > 0 && tokens.every((token) => SLOW_QUICK.test(token));
}

/**
 * The elements of a rhythm written in counts, in order, or null when it is not one (slows and
 * quicks included). Each beat is the next one from 1; `&` and `a` follow a beat, `&` first and
 * each once; a token starts on a beat, and only the last one may end on a subdivision.
 */
export function rhythmElements(rhythm: string): RhythmElement[] | null {
  const tokens = tokensOf(rhythm);
  if (tokens.length === 0) return null;
  const elements: RhythmElement[] = [];
  let beat = 0;
  for (const [index, token] of tokens.entries()) {
    const own = tokenElements(token);
    if (!own) return null;
    let previous: RhythmElement["value"] | undefined;
    for (const element of own) {
      const { value } = element;
      if (typeof value === "number") {
        // A beat starts the token, or follows a subdivision: `3(4)` would read as `3 (4)`.
        if (typeof previous === "number" || value !== beat + 1) return null;
        beat = value;
      } else if (
        previous === undefined ||
        previous === "a" ||
        (value === "&" && previous === "&")
      ) {
        return null;
      }
      previous = value;
      elements.push(element);
    }
    if (typeof previous !== "number" && index < tokens.length - 1) return null;
  }
  return elements;
}

/** How a rhythm's elements are written: a space only between two beats. */
function writeElements(elements: RhythmElement[]): string {
  return elements
    .map(({ value, held }, i) => {
      const text = held ? `(${value})` : `${value}`;
      const spaced =
        i > 0 &&
        typeof value === "number" &&
        typeof elements[i - 1].value === "number";
      return spaced ? ` ${text}` : text;
    })
    .join("");
}

const lastBeat = (elements: RhythmElement[]) =>
  elements.reduce((n, { value }) => (typeof value === "number" ? value : n), 0);

/**
 * How many counts a rhythm takes, or null when it is not one: its last beat number (subdivisions
 * after it add none). Slows and quicks count in quicks.
 */
export function rhythmCounts(rhythm: string): number | null {
  if (isSlowQuickRhythm(rhythm)) {
    return tokensOf(rhythm).reduce(
      (n, token) => n + (/s/i.test(token) ? 2 : 1),
      0,
    );
  }
  const elements = rhythmElements(rhythm);
  return elements ? lastBeat(elements) : null;
}

export function rhythmMatchesCounts(rhythm: string, counts: number): boolean {
  return rhythmCounts(rhythm) === counts;
}

/**
 * A rhythm in its one spelling, so equal rhythms compare equal: single spaces, slows and quicks
 * in capitals, beat numbers without leading zeros. Text that is not a rhythm only has its
 * spacing tidied.
 */
export function normalizeRhythm(rhythm: string): string {
  const elements = rhythmElements(rhythm);
  if (elements) return writeElements(elements);
  return tokensOf(rhythm)
    .map((token) => (SLOW_QUICK.test(token) ? token.toUpperCase() : token))
    .join(" ");
}

/**
 * Why text is not a rhythm, for the form to explain: `mixed` when it mixes beat numbers with
 * slows and quicks, `slowQuickJoin` when it joins slows and quicks with `&` or `a` (`Q&Q` is
 * not verified), `markOrder` when a beat's `&` and `a` come out of order or twice (`3a&4`),
 * `markSplit` when a subdivision is spaced off the beat it leads to (`3& 4`, written `3&4`),
 * else `invalid`. Null when it is a rhythm, or nothing is written.
 */
export type RhythmProblem =
  "mixed" | "slowQuickJoin" | "markOrder" | "markSplit" | "invalid";
export function rhythmProblem(text: string): RhythmProblem | null {
  if (!text.trim() || rhythmCounts(text) !== null) return null;
  const slowQuick = /[sq]/i.test(text);
  if (slowQuick && /\d/.test(text)) return "mixed";
  if (slowQuick && /[&a]/i.test(text)) return "slowQuickJoin";
  const runs = text.replace(/[()]/g, "").match(/[&a]+/g) ?? [];
  if (runs.some((run) => run !== "&" && run !== "a" && run !== "&a")) {
    return "markOrder";
  }
  const joined = text.replace(/([&a]\)?)\s+(?=\(?\d)/g, "$1");
  if (joined !== text && rhythmCounts(joined) !== null) return "markSplit";
  return "invalid";
}

/** Counts and a rhythm that go together: a figure's, or a variant's own (`IVariantOverrides`). */
export interface Timing {
  counts?: number;
  rhythm?: string;
}

/**
 * `timing` with new counts (or none), dropping a rhythm that no longer fits. Keys go rather
 * than hold `undefined`, which Firestore refuses.
 */
export function withTimingCounts<T extends Timing>(
  timing: T,
  counts: number | undefined,
): T {
  const { counts: _counts, rhythm, ...rest } = timing;
  const fits =
    !!rhythm && counts !== undefined && rhythmMatchesCounts(rhythm, counts);
  return {
    ...rest,
    ...(counts !== undefined && { counts }),
    ...(fits && { rhythm }),
  } as T;
}

/**
 * `timing` with what is typed in its rhythm field: a rhythm sets the counts it takes; text that
 * is not one yet (or none) leaves the counts and carries no rhythm.
 */
export function withTimingRhythm<T extends Timing>(timing: T, text: string): T {
  const { rhythm: _previous, ...rest } = timing;
  const counts = rhythmCounts(text);
  return (
    counts === null ? rest : { ...rest, counts, rhythm: normalizeRhythm(text) }
  ) as T;
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

/** An element as it is written: `5`, `&`, or held, `(5)`, `(&)`. */
export function rhythmElementText(
  value: RhythmElement["value"],
  held = false,
): string {
  return held ? `(${value})` : `${value}`;
}

/**
 * What can be added next, one element at a time, for composing a rhythm with taps: the next
 * beat, then `&` after a beat and `a` after a beat or its `&`, in that order. `[1]` while
 * nothing is written; nothing after slows and quicks or what is not a rhythm, since no next
 * beat follows from it.
 */
export function nextRhythmElements(written: string): RhythmElement["value"][] {
  const elements = written.trim() ? rhythmElements(written) : [];
  if (!elements) return [];
  const last = elements[elements.length - 1]?.value;
  const marks: RhythmMark[] =
    last === undefined || last === "a" ? [] : last === "&" ? ["a"] : ["&", "a"];
  return [lastBeat(elements) + 1, ...marks];
}

/**
 * `written` with one more element on the end, held or not, in the one spelling: a beat after a
 * subdivision chains on (`3&` + 4 → `3&4`), after a beat it starts a new token (`3 4`).
 * Unchanged when what is written is not a rhythm in counts.
 */
export function appendRhythmElement(
  written: string,
  value: RhythmElement["value"],
  held = false,
): string {
  const elements = written.trim() ? rhythmElements(written) : [];
  return elements ? writeElements([...elements, { value, held }]) : written;
}

/**
 * The slow and the quick, to tap on: while nothing is written (a way to start a rhythm in slows
 * and quicks), and after slows and quicks. Nothing after beat numbers, which they do not mix with.
 */
export function slowQuickSteps(written: string): string[] {
  return !written.trim() || isSlowQuickRhythm(written) ? ["S", "Q"] : [];
}

/** `written` with one more token on the end: a slow or a quick. */
export function appendRhythmStep(written: string, step: string): string {
  const trimmed = written.trim();
  return trimmed ? `${trimmed} ${step}` : step;
}

/**
 * What the undo takes off `written`: the last element of a rhythm in counts (`a` of `3&a`, `(4)`
 * of `3&(4)`), else the last token (a slow or a quick, or a word of text that is not a rhythm
 * yet). `undefined` when nothing is written.
 */
export function lastRhythmStep(written: string): string | undefined {
  const elements = rhythmElements(written);
  const last = elements?.[elements.length - 1];
  return last
    ? rhythmElementText(last.value, last.held)
    : tokensOf(written).pop();
}

/** `written` without what `lastRhythmStep` names: undoes exactly the last tap, to fix a mistap. */
export function removeLastRhythmStep(written: string): string {
  const elements = rhythmElements(written);
  if (elements) return writeElements(elements.slice(0, -1));
  return tokensOf(written).slice(0, -1).join(" ");
}
