import {
  GRAPH_LAYOUT_VERSION,
  resolveLayout,
  StoredGraphLayout,
  toStoredLayout,
} from "@/src/pattern/graph/model/resolveLayout";
import { calculateGraphLayout } from "@/src/pattern/graph/utils/NetworkGraphUtils";
import { LayoutPosition } from "@/src/pattern/graph/utils/GraphUtils";
import { MAX_GRAPH_COORDINATE } from "@/src/pattern/graph/types/Constants";
import { IPattern } from "@/src/pattern/types/IPatternList";
import {
  createTestPattern,
  createTestPatternType,
} from "@/utils/testFactories";

const TYPE = createTestPatternType({ slug: "push" });

const pattern = (id: number, prerequisites: number[] = []): IPattern =>
  createTestPattern(TYPE.id, { id, name: `P${id}`, prerequisites });

const stored = (
  positions: Record<number, { x: number; y: number }>,
): StoredGraphLayout => ({
  version: GRAPH_LAYOUT_VERSION,
  positions: Object.fromEntries(
    Object.entries(positions).map(([id, point]) => [id, point]),
  ),
  updatedAt: 1,
});

const auto = (
  positions: Record<number, { x: number; y: number }>,
): Map<number, LayoutPosition> =>
  new Map(Object.entries(positions).map(([id, p]) => [Number(id), p]));

const distance = (a: LayoutPosition, b: LayoutPosition) =>
  Math.hypot(a.x - b.x, a.y - b.y);

describe("resolveLayout", () => {
  describe("with nothing stored", () => {
    it("is the automatic layout, untouched", () => {
      const patterns = [pattern(1), pattern(2, [1])];
      const autoLayout = auto({ 1: { x: 10, y: 20 }, 2: { x: 30, y: 40 } });

      const { positions } = resolveLayout(patterns, null, autoLayout);

      expect(positions.get(1)).toEqual({ x: 10, y: 20 });
      expect(positions.get(2)).toEqual({ x: 30, y: 40 });
    });

    it("treats an empty stored layout the same as none", () => {
      const autoLayout = auto({ 1: { x: 10, y: 20 } });

      const { positions } = resolveLayout([pattern(1)], stored({}), autoLayout);

      expect(positions.get(1)).toEqual({ x: 10, y: 20 });
    });

    it("seeds nothing", () => {
      const { seededIds } = resolveLayout(
        [pattern(1)],
        null,
        auto({ 1: { x: 0, y: 0 } }),
      );

      expect(seededIds).toEqual([]);
    });
  });

  describe("with a full stored layout", () => {
    it("uses every stored position", () => {
      const patterns = [pattern(1), pattern(2, [1])];
      const layout = stored({ 1: { x: 100, y: 0 }, 2: { x: 200, y: 0 } });

      const { positions } = resolveLayout(patterns, layout, auto({}));

      expect(positions.get(1)).toEqual({ x: 100, y: 0 });
      expect(positions.get(2)).toEqual({ x: 200, y: 0 });
    });

    it("ignores the automatic layout entirely", () => {
      const layout = stored({ 1: { x: 100, y: 0 } });

      const { positions } = resolveLayout(
        [pattern(1)],
        layout,
        auto({ 1: { x: -999, y: -999 } }),
      );

      expect(positions.get(1)).toEqual({ x: 100, y: 0 });
    });

    it("places every pattern it is given", () => {
      // The same invariant the automatic layout is held to: an unpositioned
      // node is simply never drawn.
      const patterns = [pattern(1), pattern(2, [1]), pattern(3, [99])];
      const layout = stored({ 1: { x: 0, y: 0 } });

      const { positions } = resolveLayout(patterns, layout, auto({}));

      expect(positions.size).toBe(patterns.length);
    });
  });

  describe("when a pattern has been added", () => {
    it("seeds it near its prerequisite, not from a global re-layout", () => {
      // The single most important behaviour here: adding one pattern must not
      // move the ones the user arranged.
      const patterns = [pattern(1), pattern(2, [1])];
      const layout = stored({ 1: { x: 500, y: 500 } });

      const { positions, seededIds } = resolveLayout(
        patterns,
        layout,
        auto({}),
      );

      expect(positions.get(1)).toEqual({ x: 500, y: 500 });
      expect(seededIds).toEqual([2]);
      expect(distance(positions.get(2)!, { x: 500, y: 500 })).toBeCloseTo(220);
    });

    it("seeds it between two prerequisites", () => {
      const patterns = [pattern(1), pattern(2), pattern(3, [1, 2])];
      const layout = stored({ 1: { x: 0, y: 0 }, 2: { x: 400, y: 0 } });

      const { positions } = resolveLayout(patterns, layout, auto({}));

      // Offset by one level from the midpoint, so it does not sit on the line.
      expect(distance(positions.get(3)!, { x: 200, y: 0 })).toBeCloseTo(220);
    });

    it("hangs a chain of new patterns off each other", () => {
      const patterns = [pattern(1), pattern(2, [1]), pattern(3, [2])];
      const layout = stored({ 1: { x: 0, y: 0 } });

      const { positions, seededIds } = resolveLayout(
        patterns,
        layout,
        auto({}),
      );

      expect(seededIds).toEqual([2, 3]);
      expect(distance(positions.get(3)!, positions.get(2)!)).toBeCloseTo(220);
    });

    it("does not stack two new siblings on the same point", () => {
      const patterns = [pattern(1), pattern(2, [1]), pattern(3, [1])];
      const layout = stored({ 1: { x: 0, y: 0 } });

      const { positions } = resolveLayout(patterns, layout, auto({}));

      expect(distance(positions.get(2)!, positions.get(3)!)).toBeGreaterThan(1);
    });

    it("falls back to its dependents when it has no prerequisites", () => {
      const patterns = [pattern(1), pattern(2, [1])];
      const layout = stored({ 2: { x: 800, y: 0 } });

      const { positions } = resolveLayout(patterns, layout, auto({}));

      expect(distance(positions.get(1)!, { x: 800, y: 0 })).toBeCloseTo(220);
    });

    it("rings an unconnected new pattern outside what is already placed", () => {
      const patterns = [pattern(1), pattern(2)];
      const layout = stored({ 1: { x: 0, y: 0 } });

      const { positions } = resolveLayout(patterns, layout, auto({}));

      expect(distance(positions.get(2)!, { x: 0, y: 0 })).toBeCloseTo(220);
    });

    it("terminates when new patterns form a cycle among themselves", () => {
      const patterns = [pattern(1), pattern(2, [3]), pattern(3, [2])];
      const layout = stored({ 1: { x: 0, y: 0 } });

      const { positions } = resolveLayout(patterns, layout, auto({}));

      expect(positions.size).toBe(3);
    });
  });

  describe("when a pattern has been deleted", () => {
    it("reports the stored entry as stale", () => {
      const layout = stored({ 1: { x: 0, y: 0 }, 7: { x: 50, y: 50 } });

      const { staleIds } = resolveLayout([pattern(1)], layout, auto({}));

      expect(staleIds).toEqual([7]);
    });

    it("does not place the deleted pattern", () => {
      const layout = stored({ 1: { x: 0, y: 0 }, 7: { x: 50, y: 50 } });

      const { positions } = resolveLayout([pattern(1)], layout, auto({}));

      expect(positions.has(7)).toBe(false);
    });

    it("falls back to the automatic layout when every stored id is gone", () => {
      const layout = stored({ 7: { x: 50, y: 50 } });

      const { positions, staleIds } = resolveLayout(
        [pattern(1)],
        layout,
        auto({ 1: { x: 10, y: 10 } }),
      );

      expect(positions.get(1)).toEqual({ x: 10, y: 10 });
      expect(staleIds).toEqual([7]);
    });

    it("ignores a stored key that is not a pattern id", () => {
      const layout: StoredGraphLayout = {
        version: GRAPH_LAYOUT_VERSION,
        positions: { abc: { x: 1, y: 2 }, "1": { x: 3, y: 4 } },
        updatedAt: 1,
      };

      const { positions, staleIds } = resolveLayout(
        [pattern(1)],
        layout,
        auto({}),
      );

      expect(staleIds).toEqual([]);
      expect(positions.get(1)).toEqual({ x: 3, y: 4 });
    });
  });

  describe("bad stored data", () => {
    it("seeds a pattern whose stored entry is not a point", () => {
      const layout: StoredGraphLayout = {
        version: GRAPH_LAYOUT_VERSION,
        positions: {
          "1": { x: 0, y: 0 },
          "2": { x: "left" } as unknown as { x: number; y: number },
        },
        updatedAt: 1,
      };

      const { positions, seededIds } = resolveLayout(
        [pattern(1), pattern(2, [1])],
        layout,
        auto({}),
      );

      // One bad coordinate costs one node's position, not the whole layout.
      expect(positions.get(1)).toEqual({ x: 0, y: 0 });
      expect(seededIds).toEqual([2]);
    });

    it("clamps a position outside the drawable box", () => {
      // A node placed beyond the clamp could never be dragged back, because it
      // would not be on screen.
      const layout = stored({ 1: { x: 999999, y: -999999 } });

      const { positions } = resolveLayout([pattern(1)], layout, auto({}));

      expect(positions.get(1)).toEqual({
        x: MAX_GRAPH_COORDINATE,
        y: -MAX_GRAPH_COORDINATE,
      });
    });

    it("replaces a non-finite coordinate with the origin", () => {
      const layout = stored({ 1: { x: NaN, y: Infinity } });

      const { positions } = resolveLayout([pattern(1)], layout, auto({}));

      expect(positions.get(1)).toEqual({ x: 0, y: 0 });
    });

    it("keeps a seeded position inside the box", () => {
      const layout = stored({
        1: { x: MAX_GRAPH_COORDINATE, y: MAX_GRAPH_COORDINATE },
      });

      const { positions } = resolveLayout(
        [pattern(1), pattern(2, [1])],
        layout,
        auto({}),
      );

      expect(Math.abs(positions.get(2)!.x)).toBeLessThanOrEqual(
        MAX_GRAPH_COORDINATE,
      );
    });
  });

  describe("filtering", () => {
    it("keeps stored positions when the node set narrows and widens again", () => {
      // Stored positions are keyed by pattern id, not by index, so a filter
      // applied and removed must leave the arrangement exactly as it was.
      const all = [pattern(1), pattern(2, [1]), pattern(3, [2])];
      const layout = stored({
        1: { x: 0, y: 0 },
        2: { x: 300, y: 0 },
        3: { x: 600, y: 0 },
      });

      const narrowed = resolveLayout([all[0], all[2]], layout, auto({}));
      const widened = resolveLayout(all, layout, auto({}));

      expect(narrowed.positions.get(3)).toEqual({ x: 600, y: 0 });
      expect(widened.positions.get(3)).toEqual({ x: 600, y: 0 });
      expect(widened.seededIds).toEqual([]);
    });

    it("does not call a filtered-out pattern stale", () => {
      // Filtering hides a pattern; it does not delete it. Pruning here would
      // throw away the user's arrangement the moment they searched.
      const layout = stored({ 1: { x: 0, y: 0 }, 2: { x: 300, y: 0 } });

      const { staleIds } = resolveLayout([pattern(1)], layout, auto({}));

      expect(staleIds).toEqual([2]);
    });
  });
});

describe("toStoredLayout", () => {
  it("round-trips through resolveLayout", () => {
    const patterns = [pattern(1), pattern(2, [1])];
    const positions = new Map<number, LayoutPosition>([
      [1, { x: 12, y: 34 }],
      [2, { x: 56, y: 78 }],
    ]);

    const { positions: resolved } = resolveLayout(
      patterns,
      toStoredLayout(positions),
      auto({}),
    );

    expect(resolved.get(1)).toEqual({ x: 12, y: 34 });
    expect(resolved.get(2)).toEqual({ x: 56, y: 78 });
  });

  it("stamps the current version", () => {
    expect(toStoredLayout(new Map()).version).toBe(GRAPH_LAYOUT_VERSION);
  });

  it("clamps on the way out as well as on the way in", () => {
    const stamped = toStoredLayout(new Map([[1, { x: 1e9, y: 0 }]]));

    expect(stamped.positions["1"].x).toBe(MAX_GRAPH_COORDINATE);
  });

  it("round-trips a real automatic layout unchanged", () => {
    const patterns = [pattern(1), pattern(2, [1]), pattern(3, [1, 2])];
    const { positions } = calculateGraphLayout(patterns, 1200, 800);

    const { positions: resolved, seededIds } = resolveLayout(
      patterns,
      toStoredLayout(positions),
      new Map(),
    );

    expect(seededIds).toEqual([]);
    for (const [id, point] of positions) {
      expect(resolved.get(id)).toEqual(point);
    }
  });
});
