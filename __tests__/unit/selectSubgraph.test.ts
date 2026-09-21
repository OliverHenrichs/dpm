import { buildAdjacency } from "@/src/pattern/graph/model/adjacency";
import {
  ChainMode,
  selectSubgraph,
} from "@/src/pattern/graph/model/selectSubgraph";
import { IPattern } from "@/src/pattern/types/IPatternList";
import {
  createTestPattern,
  createTestPatternType,
} from "@/utils/testFactories";

const TYPE = createTestPatternType({ slug: "push" });

const pattern = (id: number, prerequisites: number[] = []): IPattern =>
  createTestPattern(TYPE.id, { id, name: `P${id}`, prerequisites });

const select = (
  patterns: IPattern[],
  matched: number[],
  mode: ChainMode,
  maxDepth?: number,
) => selectSubgraph(buildAdjacency(patterns), new Set(matched), mode, maxDepth);

const included = (...args: Parameters<typeof select>) =>
  [...select(...args).included].sort((a, b) => a - b);

/** 1 → 2 → 3 → 4, plus an unrelated 9. */
const CHAIN = [
  pattern(1),
  pattern(2, [1]),
  pattern(3, [2]),
  pattern(4, [3]),
  pattern(9),
];

describe("selectSubgraph", () => {
  describe("matchesOnly", () => {
    it("pulls in no context at all", () => {
      expect(included(CHAIN, [3], "matchesOnly")).toEqual([3]);
    });

    it("keeps several matches", () => {
      expect(included(CHAIN, [1, 9], "matchesOnly")).toEqual([1, 9]);
    });
  });

  describe("prerequisites", () => {
    it("walks backwards, transitively", () => {
      expect(included(CHAIN, [3], "prerequisites")).toEqual([1, 2, 3]);
    });

    it("does not pull in what comes after", () => {
      expect(included(CHAIN, [3], "prerequisites")).not.toContain(4);
    });

    it("leaves a root alone", () => {
      expect(included(CHAIN, [1], "prerequisites")).toEqual([1]);
    });
  });

  describe("dependents", () => {
    it("walks forwards, transitively", () => {
      expect(included(CHAIN, [2], "dependents")).toEqual([2, 3, 4]);
    });

    it("does not pull in what comes before", () => {
      expect(included(CHAIN, [2], "dependents")).not.toContain(1);
    });
  });

  describe("fullChain", () => {
    it("walks both ways from the match", () => {
      expect(included(CHAIN, [3], "fullChain")).toEqual([1, 2, 3, 4]);
    });

    it("still excludes a disconnected component", () => {
      expect(included(CHAIN, [3], "fullChain")).not.toContain(9);
    });
  });

  describe("shapes that are not a straight line", () => {
    // 1 → 2 → 4, 1 → 3 → 4: two distinct paths to the same node.
    const DIAMOND = [
      pattern(1),
      pattern(2, [1]),
      pattern(3, [1]),
      pattern(4, [2, 3]),
    ];

    it("includes every path to a match, not just the first", () => {
      expect(included(DIAMOND, [4], "prerequisites")).toEqual([1, 2, 3, 4]);
    });

    it("visits a shared ancestor once", () => {
      // Regression guard on the multi-source BFS: 1 is reachable via both 2
      // and 3, and must not be expanded twice.
      const selection = select(DIAMOND, [4], "prerequisites");

      expect(selection.included.size).toBe(4);
    });

    it("terminates on a cycle", () => {
      const cyclic = [pattern(1, [2]), pattern(2, [1]), pattern(3, [2])];

      expect(included(cyclic, [3], "prerequisites")).toEqual([1, 2, 3]);
    });

    it("handles a match that is its own prerequisite", () => {
      expect(included([pattern(1, [1])], [1], "fullChain")).toEqual([1]);
    });
  });

  describe("maxDepth", () => {
    it("truncates the walk at the given radius", () => {
      expect(included(CHAIN, [4], "prerequisites", 2)).toEqual([2, 3, 4]);
    });

    it("counts from the nearest match, not from each one", () => {
      // 1 is two steps from 3 but adjacent to 2, so it survives a radius of 1.
      expect(included(CHAIN, [2, 3], "prerequisites", 1)).toEqual([1, 2, 3]);
    });

    it("of zero degenerates to matchesOnly", () => {
      expect(included(CHAIN, [3], "fullChain", 0)).toEqual([3]);
    });

    it("larger than the graph is the same as no limit", () => {
      expect(included(CHAIN, [4], "prerequisites", 99)).toEqual([1, 2, 3, 4]);
    });
  });

  describe("edge cases", () => {
    it("selects nothing for an empty match set", () => {
      const selection = select(CHAIN, [], "fullChain");

      expect(selection.included.size).toBe(0);
      expect(selection.matched.size).toBe(0);
    });

    it("ignores a matched id that is not in the graph", () => {
      // A stale match set must not poison the rest of the selection.
      expect(included(CHAIN, [3, 404], "prerequisites")).toEqual([1, 2, 3]);
    });

    it("selects the whole graph when everything matches", () => {
      const all = CHAIN.map((p) => p.id);

      expect(included(CHAIN, all, "matchesOnly")).toEqual([1, 2, 3, 4, 9]);
    });

    it("reports matches separately from the context they pulled in", () => {
      const selection = select(CHAIN, [3], "prerequisites");

      expect([...selection.matched]).toEqual([3]);
      expect(selection.included.size).toBe(3);
    });

    it("handles an empty graph", () => {
      expect(included([], [1], "fullChain")).toEqual([]);
    });
  });
});
