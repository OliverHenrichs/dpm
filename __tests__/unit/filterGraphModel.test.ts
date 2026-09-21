import { buildGraphModel } from "@/src/pattern/graph/model/GraphModel";
import { filterGraphModel } from "@/src/pattern/graph/model/filterGraphModel";
import { ChainMode } from "@/src/pattern/graph/model/selectSubgraph";
import { calculateGraphLayout } from "@/src/pattern/graph/utils/NetworkGraphUtils";
import { IPattern } from "@/src/pattern/types/IPatternList";
import {
  createRandomPatternGraph,
  createTestPattern,
  createTestPatternType,
  seededRandom,
} from "@/utils/testFactories";

const TYPE = createTestPatternType({ slug: "push", color: "#FF0000" });

const pattern = (id: number, prerequisites: number[] = []): IPattern =>
  createTestPattern(TYPE.id, { id, name: `P${id}`, prerequisites });

const filtered = (
  patterns: IPattern[],
  matched: number[],
  mode: ChainMode = "matchesOnly",
  maxDepth?: number,
) =>
  filterGraphModel(
    buildGraphModel(patterns, [TYPE]),
    new Set(matched),
    mode,
    maxDepth,
  );

const ids = (model: { nodes: { pattern: IPattern }[] }) =>
  model.nodes.map((n) => n.pattern.id).sort((a, b) => a - b);

/** 1 → 2 → 3 → 4 */
const CHAIN = [pattern(1), pattern(2, [1]), pattern(3, [2]), pattern(4, [3])];

describe("filterGraphModel", () => {
  describe("which nodes survive", () => {
    it("keeps only the matches in matchesOnly", () => {
      expect(ids(filtered(CHAIN, [2]))).toEqual([2]);
    });

    it("keeps the chain in prerequisites mode", () => {
      expect(ids(filtered(CHAIN, [3], "prerequisites"))).toEqual([1, 2, 3]);
    });

    it("keeps the input order of the full model", () => {
      const model = filtered(
        [pattern(3), pattern(1), pattern(2)],
        [1, 2, 3],
        "matchesOnly",
      );

      expect(model.nodes.map((n) => n.pattern.id)).toEqual([3, 1, 2]);
    });
  });

  describe("matches versus context", () => {
    it("flags a direct match", () => {
      const model = filtered(CHAIN, [3], "prerequisites");
      const node = model.nodes.find((n) => n.pattern.id === 3)!;

      expect([node.isMatch, node.isContext]).toEqual([true, false]);
    });

    it("flags a node pulled in only as context", () => {
      const model = filtered(CHAIN, [3], "prerequisites");
      const node = model.nodes.find((n) => n.pattern.id === 1)!;

      expect([node.isMatch, node.isContext]).toEqual([false, true]);
    });

    it("leaves an unfiltered model with everything a match", () => {
      const model = buildGraphModel(CHAIN, [TYPE]);

      expect(model.nodes.every((n) => n.isMatch && !n.isContext)).toBe(true);
    });
  });

  describe("edge rewriting", () => {
    it("keeps an edge whose prerequisite is still shown", () => {
      const model = filtered(CHAIN, [1, 2], "matchesOnly");

      expect(model.edges).toEqual([{ from: 1, to: 2, kind: "direct" }]);
    });

    it("elides an edge across a hidden node", () => {
      // 1 → 2 → 3 with 2 hidden: 3 must still show that 1 comes before it.
      const model = filtered(CHAIN, [1, 3], "matchesOnly");

      expect(model.edges).toEqual([{ from: 1, to: 3, kind: "elided" }]);
    });

    it("elides across a run of several hidden nodes", () => {
      const model = filtered(CHAIN, [1, 4], "matchesOnly");

      expect(model.edges).toEqual([{ from: 1, to: 4, kind: "elided" }]);
    });

    it("drops an edge with no shown ancestor at all", () => {
      const model = filtered(CHAIN, [3], "matchesOnly");

      expect(model.edges).toEqual([]);
    });

    it("elides onto every shown ancestor of a diamond", () => {
      // 1 → 2 → 4 and 1 → 3 → 4; hide 2 and 3 and both paths collapse to one.
      const diamond = [
        pattern(1),
        pattern(2, [1]),
        pattern(3, [1]),
        pattern(4, [2, 3]),
      ];
      const model = filterGraphModel(
        buildGraphModel(diamond, [TYPE]),
        new Set([1, 4]),
        "matchesOnly",
      );

      expect(model.edges).toEqual([{ from: 1, to: 4, kind: "elided" }]);
    });

    it("prefers a direct edge over an elided one to the same node", () => {
      // 4 requires 2 directly and 3; hiding 3 elides onto 2, which is already
      // a direct edge. Drawing that dashed would claim a whole path is broken.
      const patterns = [pattern(2), pattern(3, [2]), pattern(4, [2, 3])];
      const model = filterGraphModel(
        buildGraphModel(patterns, [TYPE]),
        new Set([2, 4]),
        "matchesOnly",
      );

      expect(model.edges).toEqual([{ from: 2, to: 4, kind: "direct" }]);
    });

    it("never elides a node onto itself", () => {
      const cyclic = [pattern(1, [2]), pattern(2, [1]), pattern(3, [2])];
      const model = filterGraphModel(
        buildGraphModel(cyclic, [TYPE]),
        new Set([1, 3]),
        "matchesOnly",
      );

      expect(model.edges.every((e) => e.from !== e.to)).toBe(true);
    });
  });

  describe("what stays on full-graph terms", () => {
    it("keeps each node at the depth it had unfiltered", () => {
      const full = buildGraphModel(CHAIN, [TYPE]);
      const model = filterGraphModel(full, new Set([4]), "matchesOnly");

      expect(model.nodes[0].depth).toBe(3);
    });

    it("keeps the depth map itself", () => {
      const full = buildGraphModel(CHAIN, [TYPE]);
      const model = filterGraphModel(full, new Set([1]), "matchesOnly");

      expect(model.depthMap).toBe(full.depthMap);
    });

    it("still reports a cycle the filter hides", () => {
      // Corrupt data does not stop being corrupt because it is off-screen.
      const cyclic = [pattern(1, [2]), pattern(2, [1]), pattern(9)];
      const full = buildGraphModel(cyclic, [TYPE]);
      const model = filterGraphModel(full, new Set([9]), "matchesOnly");

      expect(model.cycles).toEqual(full.cycles);
    });

    it("keeps the type colour map", () => {
      const model = filtered(CHAIN, [1]);

      expect(model.nodes[0].color).toBe("#FF0000");
    });
  });

  describe("foundational, on the other hand, is judged on what is drawn", () => {
    it("anchors a node whose prerequisites are all hidden", () => {
      const model = filtered(CHAIN, [3], "matchesOnly");

      expect(model.nodes[0].foundational).toBe(true);
    });

    it("does not anchor one whose prerequisite is shown", () => {
      const model = filtered(CHAIN, [1, 2], "matchesOnly");
      const node = model.nodes.find((n) => n.pattern.id === 2)!;

      expect(node.foundational).toBe(false);
    });
  });

  describe("the invariant that keeps nodes on screen", () => {
    it("rewrites the prerequisites the layout will read", () => {
      const model = filtered(CHAIN, [1, 3], "matchesOnly");
      const node = model.nodes.find((n) => n.pattern.id === 3)!;

      expect(node.pattern.prerequisites).toEqual([1]);
    });

    it("does not mutate the patterns of the model it narrows", () => {
      const full = buildGraphModel(CHAIN, [TYPE]);
      filterGraphModel(full, new Set([1, 3]), "matchesOnly");

      expect(full.nodes[2].pattern.prerequisites).toEqual([2]);
    });

    it("agrees with its own edge list", () => {
      const model = filtered(CHAIN, [1, 4], "matchesOnly");

      for (const node of model.nodes) {
        const froms = model.edges
          .filter((e) => e.to === node.pattern.id)
          .map((e) => e.from);
        expect([...node.pattern.prerequisites].sort()).toEqual(froms.sort());
      }
    });

    /**
     * The property the whole module exists for.
     *
     * The network layout positions a node only once every one of its
     * prerequisites is positioned, and `drawNodes` renders nothing for an
     * unpositioned node — so a single id pointing outside the shown set makes
     * that node and its whole subtree vanish with no error. Passing a filtered
     * `patterns` array straight to the layout is exactly that bug.
     */
    it("leaves no prerequisite pointing outside the shown set, for any input", () => {
      const modes: ChainMode[] = [
        "matchesOnly",
        "prerequisites",
        "dependents",
        "fullChain",
      ];

      for (let seed = 1; seed <= 40; seed++) {
        const random = seededRandom(seed * 7919);
        const patterns = createRandomPatternGraph(TYPE.id, seed, {
          patternCount: 20,
          edgeProbability: 0.18,
          danglingCount: seed % 3,
          cycleCount: seed % 4,
        });
        const full = buildGraphModel(patterns, [TYPE]);
        const matched = new Set(
          patterns.filter(() => random() < 0.3).map((p) => p.id),
        );
        const mode = modes[seed % modes.length];

        const model = filterGraphModel(full, matched, mode);
        const shown = new Set(model.nodes.map((n) => n.pattern.id));

        for (const node of model.nodes) {
          for (const prereqId of node.pattern.prerequisites) {
            expect({
              seed,
              mode,
              id: node.pattern.id,
              prereqId,
              shown: true,
            }).toEqual({
              seed,
              mode,
              id: node.pattern.id,
              prereqId,
              shown: shown.has(prereqId),
            });
          }
        }
      }
    });

    it("lets the network layout place every node it is given, for any input", () => {
      // The invariant above is only worth anything if it is what the layout
      // actually needs. This asserts the consequence directly.
      for (let seed = 1; seed <= 20; seed++) {
        const random = seededRandom(seed * 104729);
        const patterns = createRandomPatternGraph(TYPE.id, seed, {
          patternCount: 18,
          edgeProbability: 0.2,
          danglingCount: seed % 3,
          cycleCount: seed % 3,
        });
        const full = buildGraphModel(patterns, [TYPE]);
        const matched = new Set(
          patterns.filter(() => random() < 0.35).map((p) => p.id),
        );

        const model = filterGraphModel(full, matched, "prerequisites");
        const { positions } = calculateGraphLayout(model.patterns, 1200, 800);

        expect({ seed, placed: positions.size }).toEqual({
          seed,
          placed: model.nodes.length,
        });
      }
    });
  });

  describe("the cheap cases", () => {
    it("returns an empty model when nothing matches", () => {
      const model = filtered(CHAIN, [], "fullChain");

      expect(model.nodes).toEqual([]);
      expect(model.edges).toEqual([]);
      expect(model.patterns).toEqual([]);
    });

    it("reproduces the full graph when everything matches", () => {
      const full = buildGraphModel(CHAIN, [TYPE]);
      const model = filterGraphModel(
        full,
        new Set(CHAIN.map((p) => p.id)),
        "matchesOnly",
      );

      expect(ids(model)).toEqual(ids(full));
      expect(model.edges).toEqual(full.edges);
    });

    it("handles an empty graph", () => {
      const model = filterGraphModel(
        buildGraphModel([], []),
        new Set([1]),
        "fullChain",
      );

      expect(model.nodes).toEqual([]);
    });
  });
});
