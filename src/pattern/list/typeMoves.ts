import { IPattern } from "@/src/pattern/types/IPatternList";

/**
 * Where the figures of each removed type go: removed type id → the type that takes them. Built
 * in list settings while types are removed, applied to the patterns when the list is saved.
 */
export type TypeMoves = Record<string, string>;

/** How many patterns use each type, by type id. */
export function countPatternsByType(
  patterns: readonly IPattern[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const pattern of patterns) {
    counts[pattern.typeId] = (counts[pattern.typeId] ?? 0) + 1;
  }
  return counts;
}

/**
 * `moves` with `from`'s figures sent to `to`. Figures moved onto `from` earlier follow it, so
 * removing Push into Pass and then Pass into Whip ends with both at Whip.
 */
export function addTypeMove<M extends TypeMoves | LevelMoves>(
  moves: M,
  from: string,
  to: string,
): M {
  const next: Record<string, string> = {};
  for (const [source, target] of Object.entries(moves)) {
    next[source] = target === from ? to : target;
  }
  next[from] = to;
  return next as M;
}

/** How many figures a type (or level) holds once the moves so far are applied. */
export function countAfterMoves(
  typeId: string,
  usage: Record<string, number>,
  moves: TypeMoves | LevelMoves,
): number {
  if (typeof moves[typeId] === "string") return 0;
  let count = usage[typeId] ?? 0;
  for (const [source, target] of Object.entries(moves)) {
    if (target === typeId) count += usage[source] ?? 0;
  }
  return count;
}

/**
 * The patterns with every moved type swapped for its target. The same array when nothing
 * moves, so a save without moves writes no patterns.
 */
export function applyTypeMoves(
  patterns: IPattern[],
  moves: TypeMoves,
): IPattern[] {
  if (!patterns.some((p) => moves[p.typeId])) return patterns;
  return patterns.map((p) =>
    moves[p.typeId] ? { ...p, typeId: moves[p.typeId] } : p,
  );
}

/**
 * Where the figures of each removed level go: removed level id → the level that takes them, or
 * `NO_LEVEL` to leave them without one. Built and applied like `TypeMoves`, and chained the
 * same way (`addTypeMove`).
 */
export type LevelMoves = Record<string, string>;

/** A `LevelMoves` target: the figures keep no level. */
export const NO_LEVEL = "";

/** How many patterns are on each level, by level id. */
export function countPatternsByLevel(
  patterns: readonly IPattern[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const pattern of patterns) {
    if (pattern.level) counts[pattern.level] = (counts[pattern.level] ?? 0) + 1;
  }
  return counts;
}

/**
 * The patterns with every moved level swapped for its target, the key removed for `NO_LEVEL`
 * (never `undefined`, which Firestore rejects). The same array when nothing moves.
 */
export function applyLevelMoves(
  patterns: IPattern[],
  moves: LevelMoves,
): IPattern[] {
  const isMoved = (p: IPattern) =>
    !!p.level && typeof moves[p.level] === "string";
  if (!patterns.some(isMoved)) return patterns;
  return patterns.map((p) => {
    if (!isMoved(p)) return p;
    const { level, ...rest } = p;
    const target = moves[level as string];
    return target === NO_LEVEL ? rest : { ...rest, level: target };
  });
}
