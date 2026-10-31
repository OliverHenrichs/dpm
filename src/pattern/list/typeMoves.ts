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
export function addTypeMove(
  moves: TypeMoves,
  from: string,
  to: string,
): TypeMoves {
  const next: TypeMoves = {};
  for (const [source, target] of Object.entries(moves)) {
    next[source] = target === from ? to : target;
  }
  next[from] = to;
  return next;
}

/** How many figures a type holds once the moves so far are applied. */
export function countAfterMoves(
  typeId: string,
  usage: Record<string, number>,
  moves: TypeMoves,
): number {
  if (moves[typeId]) return 0;
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
