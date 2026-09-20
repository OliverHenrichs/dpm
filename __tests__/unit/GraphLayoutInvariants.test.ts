import { IPattern } from "@/src/pattern/types/IPatternList";
import { calculateGraphLayout } from "@/src/pattern/graph/utils/NetworkGraphUtils";
import { calculateDynamicTimelineLayout } from "@/src/pattern/graph/utils/TimelineGraphUtils";
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
  return calculateDynamicTimelineLayout(patterns, [TYPE], WIDTH, HEIGHT)
    .positions;
}

/**
 * The layouts are the last thing standing between the data and what the user
 * sees. A node the layout declines to position is not drawn — `drawNodes`
 * returns null for it — so it vanishes from the graph with no error anywhere.
 *
 * "Every node gets a position" is therefore the invariant worth holding onto,
 * and the cases that break it are recorded below as `test.failing`, which
 * passes while the bug exists and starts failing the moment it is fixed.
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
    // Known defects. See AGENT_TASKS.md B1 and B2.
    // ---------------------------------------------------------------------

    test.failing(
      "positions a node that lists a prerequisite which no longer exists (B1)",
      () => {
        // Deleting pattern 1 does not scrub it from pattern 2's prerequisites,
        // so id 1 is never positioned, the `prerequisites.every(positioned)`
        // gate never opens, and 2 and 3 silently disappear from the graph.
        const patterns = [pattern(2, [1]), pattern(3, [2])];

        expect(networkPositions(patterns).size).toBe(patterns.length);
      },
    );

    test.failing("positions nodes that form a cycle (B2)", () => {
      // Nothing prevents the user from creating A -> B -> A, and neither node
      // can ever satisfy the gate.
      const patterns = [pattern(1, [2]), pattern(2, [1])];

      expect(networkPositions(patterns).size).toBe(patterns.length);
    });

    test.failing("positions a node that is its own prerequisite (B2)", () => {
      expect(networkPositions([pattern(1, [1])]).size).toBe(1);
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

    it("handles an empty pattern set", () => {
      expect(timelinePositions([]).size).toBe(0);
    });
  });
});
