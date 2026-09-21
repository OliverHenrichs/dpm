import { IPattern } from "@/src/pattern/types/IPatternList";
import { calculateGraphLayout } from "@/src/pattern/graph/utils/NetworkGraphUtils";
import { calculateDynamicTimelineLayout } from "@/src/pattern/graph/utils/TimelineGraphUtils";
import {
  buildAdjacency,
  buildDepthMap,
} from "@/src/pattern/graph/model/adjacency";
import {
  createTestPattern,
  createTestPatternType,
} from "@/utils/testFactories";

const WIDTH = 1200;
const HEIGHT = 800;

const TYPE = createTestPatternType({ slug: "push" });

function pattern(id: number, prerequisites: number[] = []): IPattern {
  return createTestPattern(TYPE.id, { id, name: `P${id}`, prerequisites });
}

function networkPositions(patterns: IPattern[]) {
  return calculateGraphLayout(patterns, WIDTH, HEIGHT).positions;
}

function timelinePositions(patterns: IPattern[]) {
  return calculateDynamicTimelineLayout(
    patterns,
    [TYPE],
    WIDTH,
    HEIGHT,
    buildDepthMap(buildAdjacency(patterns)),
  ).positions;
}

/**
 * The layouts are the last thing standing between the data and what the user
 * sees. A node the layout declines to position is not drawn — `drawNodes`
 * returns null for it — so it vanishes from the graph with no error anywhere.
 *
 * "Every node gets a position" is therefore the invariant worth holding onto,
 * and it has to hold for degenerate input too: cycles and dangling
 * prerequisite ids are prevented at the source now, but lists written by older
 * builds still contain them, and losing a node is far worse than drawing it in
 * an odd place.
 */
describe("graph layout invariants", () => {
  describe("network layout", () => {
    it("positions an isolated node", () => {
      expect(networkPositions([pattern(1)]).size).toBe(1);
    });

    it("positions every node in a linear chain", () => {
      const patterns = [pattern(1), pattern(2, [1]), pattern(3, [2])];

      expect(networkPositions(patterns).size).toBe(patterns.length);
    });

    it("positions every node in a diamond", () => {
      const patterns = [
        pattern(1),
        pattern(2, [1]),
        pattern(3, [1]),
        pattern(4, [2, 3]),
      ];

      expect(networkPositions(patterns).size).toBe(patterns.length);
    });

    it("positions a node whose prerequisites span two foundational subtrees", () => {
      const patterns = [
        pattern(1),
        pattern(2),
        pattern(3, [1]),
        pattern(4, [2]),
        pattern(5, [3, 4]),
      ];

      expect(networkPositions(patterns).size).toBe(patterns.length);
    });

    it("positions every node across several disconnected components", () => {
      const patterns = [
        pattern(1),
        pattern(2, [1]),
        pattern(10),
        pattern(11, [10]),
        pattern(20),
      ];

      expect(networkPositions(patterns).size).toBe(patterns.length);
    });

    it("gives distinct positions to sibling nodes", () => {
      const patterns = [pattern(1), pattern(2, [1]), pattern(3, [1])];
      const positions = networkPositions(patterns);

      expect(positions.get(2)).not.toEqual(positions.get(3));
    });

    it("is deterministic for the same input", () => {
      const build = () => [pattern(1), pattern(2, [1]), pattern(3, [1, 2])];

      expect([...networkPositions(build()).entries()]).toEqual([
        ...networkPositions(build()).entries(),
      ]);
    });

    it("clamps positions so the canvas cannot grow without bound", () => {
      // A long chain marches outward one DEPTH_SPACING at a time.
      const patterns = [
        pattern(1),
        ...Array.from({ length: 60 }, (_, i) => pattern(i + 2, [i + 1])),
      ];

      for (const position of networkPositions(patterns).values()) {
        expect(Math.abs(position.x)).toBeLessThanOrEqual(4000);
        expect(Math.abs(position.y)).toBeLessThanOrEqual(4000);
      }
    });

    // ---------------------------------------------------------------------
    // Degenerate input. Cycles and dangling prerequisite ids are now prevented
    // at the source (AGENT_TASKS.md B1/B2), but data written by older builds
    // still contains them, so the layout has to cope rather than drop nodes.
    // ---------------------------------------------------------------------

    it("positions a node that lists a prerequisite which no longer exists", () => {
      const patterns = [pattern(2, [1]), pattern(3, [2])];

      expect(networkPositions(patterns).size).toBe(patterns.length);
    });

    it("positions a whole chain hanging off a missing prerequisite", () => {
      const patterns = [
        pattern(2, [1]),
        pattern(3, [2]),
        pattern(4, [3]),
        pattern(5, [3]),
      ];

      expect(networkPositions(patterns).size).toBe(patterns.length);
    });

    it("positions nodes that form a cycle", () => {
      const patterns = [pattern(1, [2]), pattern(2, [1])];

      expect(networkPositions(patterns).size).toBe(patterns.length);
    });

    it("positions nodes in a longer cycle", () => {
      const patterns = [pattern(1, [3]), pattern(2, [1]), pattern(3, [2])];

      expect(networkPositions(patterns).size).toBe(patterns.length);
    });

    it("positions a node that is its own prerequisite", () => {
      expect(networkPositions([pattern(1, [1])]).size).toBe(1);
    });

    it("positions a healthy graph hanging off a cycle", () => {
      const patterns = [
        pattern(1, [2]),
        pattern(2, [1]),
        pattern(3, [1]),
        pattern(4, [3]),
      ];

      expect(networkPositions(patterns).size).toBe(patterns.length);
    });

    it("keeps unanchored nodes from stacking on one another", () => {
      // None of these can be anchored to a prerequisite, so they go on the
      // fallback ring; they must still be distinguishable.
      const patterns = [pattern(1, [99]), pattern(2, [98]), pattern(3, [97])];

      const positions = networkPositions(patterns);
      const distinct = new Set(
        [...positions.values()].map((p) => `${p.x},${p.y}`),
      );
      expect(distinct.size).toBe(3);
    });

    it("positions every node when the entire graph is one cycle", () => {
      const patterns = [pattern(1, [2]), pattern(2, [3]), pattern(3, [1])];

      expect(networkPositions(patterns).size).toBe(patterns.length);
    });
  });

  describe("timeline layout", () => {
    it("positions every node in a linear chain", () => {
      const patterns = [pattern(1), pattern(2, [1]), pattern(3, [2])];

      expect(timelinePositions(patterns).size).toBe(patterns.length);
    });

    it("still positions nodes with a dangling prerequisite", () => {
      // Unlike the network layout, the timeline positions by depth, so a
      // missing prerequisite degrades rather than hiding the node. This is why
      // B1 presents as "the graph view is missing patterns the list shows".
      const patterns = [pattern(2, [1]), pattern(3, [2])];

      expect(timelinePositions(patterns).size).toBe(patterns.length);
    });

    it("places deeper patterns further right", () => {
      const positions = timelinePositions([
        pattern(1),
        pattern(2, [1]),
        pattern(3, [2]),
      ]);

      expect(positions.get(1)!.x).toBeLessThan(positions.get(2)!.x);
      expect(positions.get(2)!.x).toBeLessThan(positions.get(3)!.x);
    });

    it("still positions nodes caught in a cycle", () => {
      const patterns = [pattern(1, [2]), pattern(2, [1])];

      expect(timelinePositions(patterns).size).toBe(patterns.length);
    });

    it("still positions a node that is its own prerequisite", () => {
      expect(timelinePositions([pattern(1, [1])]).size).toBe(1);
    });

    it("handles an empty pattern set", () => {
      expect(timelinePositions([]).size).toBe(0);
    });
  });
});
