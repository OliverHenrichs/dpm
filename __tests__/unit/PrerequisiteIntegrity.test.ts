import { IPattern } from "@/src/pattern/types/IPatternList";
import {
  collectDependentIds,
  findIneligiblePrerequisiteIds,
  repairDanglingPrerequisites,
} from "@/src/pattern/graph/utils/GenericGraphUtils";
import { createTestPattern } from "@/utils/testFactories";

function pattern(id: number, prerequisites: number[] = []): IPattern {
  return createTestPattern("type", { id, name: `P${id}`, prerequisites });
}

const ids = (set: Set<number>) => [...set].sort((a, b) => a - b);

/**
 * `prerequisites` points *backwards*: `P.prerequisites = [Q]` means Q must be
 * learned before P, i.e. the edge runs Q → P. Getting that direction wrong is
 * the easy mistake here, so the tests name it explicitly.
 */
describe("collectDependentIds", () => {
  it("finds the direct dependents of a pattern", () => {
    const patterns = [pattern(1), pattern(2, [1]), pattern(3, [1])];

    expect(ids(collectDependentIds(patterns, 1))).toEqual([2, 3]);
  });

  it("follows the chain transitively", () => {
    const patterns = [pattern(1), pattern(2, [1]), pattern(3, [2])];

    expect(ids(collectDependentIds(patterns, 1))).toEqual([2, 3]);
  });

  it("does not walk backwards into prerequisites", () => {
    const patterns = [pattern(1), pattern(2, [1]), pattern(3, [2])];

    expect(ids(collectDependentIds(patterns, 3))).toEqual([]);
  });

  it("returns nothing for a leaf", () => {
    const patterns = [pattern(1), pattern(2, [1])];

    expect(ids(collectDependentIds(patterns, 2))).toEqual([]);
  });

  it("collects each dependent once through a diamond", () => {
    const patterns = [
      pattern(1),
      pattern(2, [1]),
      pattern(3, [1]),
      pattern(4, [2, 3]),
    ];

    expect(ids(collectDependentIds(patterns, 1))).toEqual([2, 3, 4]);
  });

  it("terminates on a cycle instead of looping forever", () => {
    const patterns = [pattern(1, [2]), pattern(2, [1])];

    expect(ids(collectDependentIds(patterns, 1))).toEqual([1, 2]);
  });

  it("terminates on a self-reference", () => {
    expect(ids(collectDependentIds([pattern(1, [1])], 1))).toEqual([1]);
  });

  it("ignores prerequisite ids that match no pattern", () => {
    const patterns = [pattern(2, [99])];

    expect(ids(collectDependentIds(patterns, 99))).toEqual([2]);
    expect(ids(collectDependentIds(patterns, 2))).toEqual([]);
  });

  it("returns nothing for an unknown id", () => {
    expect(ids(collectDependentIds([pattern(1)], 42))).toEqual([]);
  });

  it("handles an empty pattern set", () => {
    expect(ids(collectDependentIds([], 1))).toEqual([]);
  });
});

describe("findIneligiblePrerequisiteIds", () => {
  it("excludes the pattern itself", () => {
    expect(ids(findIneligiblePrerequisiteIds([pattern(1)], 1))).toEqual([1]);
  });

  it("excludes everything that already depends on the pattern", () => {
    const patterns = [pattern(1), pattern(2, [1]), pattern(3, [2])];

    // Making 2 or 3 a prerequisite of 1 would close a loop.
    expect(ids(findIneligiblePrerequisiteIds(patterns, 1))).toEqual([1, 2, 3]);
  });

  it("leaves unrelated patterns selectable", () => {
    const patterns = [pattern(1), pattern(2, [1]), pattern(10), pattern(11)];

    const ineligible = findIneligiblePrerequisiteIds(patterns, 1);
    expect(ineligible.has(10)).toBe(false);
    expect(ineligible.has(11)).toBe(false);
  });

  it("leaves a pattern's own prerequisites selectable", () => {
    const patterns = [pattern(1), pattern(2, [1])];

    // 1 is already a prerequisite of 2; re-selecting it is not a cycle.
    expect(findIneligiblePrerequisiteIds(patterns, 2).has(1)).toBe(false);
  });

  it("excludes nothing for a pattern that does not exist yet", () => {
    const patterns = [pattern(1), pattern(2, [1])];

    expect(ids(findIneligiblePrerequisiteIds(patterns, undefined))).toEqual([]);
  });
});

describe("repairDanglingPrerequisites", () => {
  it("drops prerequisite ids with no matching pattern", () => {
    const patterns = [pattern(2, [1]), pattern(3, [2])];

    const repaired = repairDanglingPrerequisites(patterns);

    expect(repaired[0].prerequisites).toEqual([]);
    expect(repaired[1].prerequisites).toEqual([2]);
  });

  it("keeps the good ids when only some are dangling", () => {
    const patterns = [pattern(1), pattern(2, [1, 99])];

    expect(repairDanglingPrerequisites(patterns)[1].prerequisites).toEqual([1]);
  });

  it("leaves a healthy set untouched, by identity", () => {
    const patterns = [pattern(1), pattern(2, [1])];

    // Same array reference, so callers can skip a needless write.
    expect(repairDanglingPrerequisites(patterns)).toBe(patterns);
  });

  it("does not mutate the input", () => {
    const patterns = [pattern(2, [1])];

    repairDanglingPrerequisites(patterns);

    expect(patterns[0].prerequisites).toEqual([1]);
  });

  it("preserves every other field", () => {
    const original = createTestPattern("type", {
      id: 2,
      name: "Whip",
      counts: 8,
      tags: ["advanced"],
      prerequisites: [1],
    });

    const [repaired] = repairDanglingPrerequisites([original]);

    expect(repaired).toEqual({ ...original, prerequisites: [] });
  });

  it("leaves a self-reference alone, since that id does exist", () => {
    // Cycles are a separate concern; this only removes references to patterns
    // that are not there.
    expect(
      repairDanglingPrerequisites([pattern(1, [1])])[0].prerequisites,
    ).toEqual([1]);
  });

  it("handles an empty set", () => {
    expect(repairDanglingPrerequisites([])).toEqual([]);
  });

  // This is how deleting a pattern cleans up after itself: filter the pattern
  // out, then repair. Before that, the deleted id stayed in every pattern that
  // required it, and those dependents vanished from the network graph.
  describe("as used by pattern deletion", () => {
    const deletePattern = (patterns: IPattern[], id: number) =>
      repairDanglingPrerequisites(patterns.filter((p) => p.id !== id));

    it("removes the pattern and every reference to it", () => {
      const patterns = [pattern(1, []), pattern(2, [1]), pattern(3, [1, 2])];

      const remaining = deletePattern(patterns, 1);

      expect(remaining.map((p) => p.id)).toEqual([2, 3]);
      expect(remaining.map((p) => p.prerequisites)).toEqual([[], [2]]);
    });

    it("leaves no prerequisite pointing at a pattern that is gone", () => {
      const patterns = [pattern(1), pattern(2, [1]), pattern(3, [2])];

      const remaining = deletePattern(patterns, 2);
      const survivingIds = new Set(remaining.map((p) => p.id));

      for (const p of remaining) {
        for (const prereq of p.prerequisites) {
          expect(survivingIds.has(prereq)).toBe(true);
        }
      }
    });

    it("keeps the id free to be reused without inheriting stale links", () => {
      // createNewId hands out max(id) + 1, so deleting the highest id and
      // adding a pattern recycles it. That is only safe because nothing still
      // references the deleted id.
      const patterns = [pattern(1), pattern(2, [1]), pattern(3, [2])];

      const remaining = deletePattern(patterns, 3);
      const recycled = [...remaining, pattern(3, [])];

      expect(recycled.filter((p) => p.prerequisites.includes(3))).toHaveLength(
        0,
      );
    });

    it("does nothing surprising when the id is not there", () => {
      const patterns = [pattern(1), pattern(2, [1])];

      expect(deletePattern(patterns, 99)).toEqual(patterns);
    });
  });
});
