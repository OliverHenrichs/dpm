import { IPattern, IPatternList } from "@/src/pattern/types/IPatternList";

/**
 * The next pattern id to hand out for a list.
 *
 * Ids used to be `max(id) + 1` over the patterns present, which makes them
 * unique *at any instant* but not *over time*: delete the highest-numbered
 * pattern and the next one created inherits its id. Nothing depended on that
 * until the manual graph layout started outliving individual patterns — a
 * stored position would then attach to whichever pattern later took the id.
 *
 * The list carries a high-water mark instead. Taking the maximum of that and
 * `max(id) + 1` matters as much as the mark itself:
 *
 * - a list written before the field existed has no mark, and behaves exactly
 *   as it did, then gains one the first time a pattern is added;
 * - a mark lost or corrupted anywhere — an old export, a hand-edited file —
 *   can never hand out an id that is already in use, because the patterns
 *   present are always consulted too.
 *
 * So there is no migration: the invariant holds from the next write onwards,
 * whatever state the stored data is in.
 */
export function nextPatternId(
  list: Pick<IPatternList, "nextPatternId"> | null | undefined,
  patterns: Pick<IPattern, "id">[],
): number {
  const highestInUse = patterns.reduce(
    (highest, pattern) =>
      Number.isInteger(pattern.id) ? Math.max(highest, pattern.id) : highest,
    0,
  );
  const mark = Number.isInteger(list?.nextPatternId)
    ? (list!.nextPatternId as number)
    : 0;
  return Math.max(mark, highestInUse + 1, 1);
}
