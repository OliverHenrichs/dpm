import { IPattern } from "@/src/pattern/types/IPatternList";
import { PatternType } from "@/src/pattern/types/PatternType";
import { orderLanes } from "@/src/pattern/graph/utils/laneOrder";
import { calculateDynamicTimelineLayout } from "@/src/pattern/graph/utils/TimelineGraphUtils";
import { calculateGraphLayout } from "@/src/pattern/graph/utils/NetworkGraphUtils";
import {
  buildAdjacency,
  buildDepthMap,
} from "@/src/pattern/graph/model/adjacency";
import {
  createTestPattern,
  createTestPatternType,
} from "@/utils/testFactories";

const slugs = (types: PatternType[]) => types.map((t) => t.slug);

describe("orderLanes", () => {
  const push = createTestPatternType({ slug: "push" });
  const pass = createTestPatternType({ slug: "pass" });
  const whip = createTestPatternType({ slug: "whip" });
  const tuck = createTestPatternType({ slug: "tuck" });
  const types = [push, pass, whip, tuck];

  const pattern = (
    id: number,
    type: PatternType,
    prerequisites: number[] = [],
  ): IPattern => createTestPattern(type.id, { id, prerequisites });

  it("gives no lane to a type with nothing shown", () => {
    const patterns = [pattern(1, push), pattern(2, whip)];
    expect(slugs(orderLanes(types, patterns))).toEqual(["push", "whip"]);
  });

  it("keeps the list's order when no edge crosses types", () => {
    const patterns = [
      pattern(1, push),
      pattern(2, pass),
      pattern(3, whip),
      pattern(4, tuck),
      pattern(5, tuck, [4]),
    ];
    expect(slugs(orderLanes(types, patterns))).toEqual(slugs(types));
  });

  it("puts linked types next to each other", () => {
    // Push → Tuck is the only link across types; listed first and last.
    const patterns = [
      pattern(1, push),
      pattern(2, pass),
      pattern(3, whip),
      pattern(4, tuck, [1]),
    ];
    const order = slugs(orderLanes(types, patterns));
    expect(Math.abs(order.indexOf("push") - order.indexOf("tuck"))).toBe(1);
  });

  it("is never worse than the list's order on a larger list", () => {
    const many = Array.from({ length: 10 }, (_, i) =>
      createTestPatternType({ slug: `t${i}` }),
    );
    // A chain t0 → t9 → t1 → t8 …, scattered across the list's order.
    const chain = [0, 9, 1, 8, 2, 7, 3, 6, 4, 5];
    const patterns = chain.map((t, i) =>
      pattern(i + 1, many[t], i === 0 ? [] : [i]),
    );
    const spread = (order: PatternType[]) => {
      const row = new Map(order.map((t, i) => [t.id, i]));
      return chain
        .slice(1)
        .reduce(
          (sum, t, i) =>
            sum + Math.abs(row.get(many[t].id)! - row.get(many[chain[i]].id)!),
          0,
        );
    };
    const order = orderLanes(many, patterns);
    expect(order).toHaveLength(10);
    expect(spread(order)).toBeLessThan(spread(many));
  });
});

describe("timeline lanes", () => {
  it("draws no lane for a type the filter hid", () => {
    const push = createTestPatternType({ slug: "push" });
    const tuck = createTestPatternType({ slug: "tuck" });
    const patterns = [createTestPattern(push.id, { id: 1 })];
    const { swimlanes } = calculateDynamicTimelineLayout(
      patterns,
      [push, tuck],
      1200,
      800,
      buildDepthMap(buildAdjacency(patterns)),
    );
    expect(swimlanes.map((s) => s.label)).toEqual(["push"]);
  });
});

describe("network ring", () => {
  it("puts unlinked patterns of one type side by side", () => {
    const a = createTestPatternType({ slug: "a" });
    const b = createTestPatternType({ slug: "b" });
    // Alternating types in the list; all roots.
    const patterns = [1, 2, 3, 4].map((id) =>
      createTestPattern(id % 2 ? a.id : b.id, { id }),
    );
    const { positions, ellipseCenterX, ellipseCenterY } = calculateGraphLayout(
      patterns,
      1200,
      800,
    );
    const angle = (id: number) => {
      const p = positions.get(id)!;
      return Math.atan2(p.y - ellipseCenterY, p.x - ellipseCenterX);
    };
    const gap = (x: number, y: number) => {
      const d = Math.abs(angle(x) - angle(y)) % (2 * Math.PI);
      return Math.min(d, 2 * Math.PI - d);
    };
    // Four roots sit a quarter turn apart; same-type ones are neighbours, not opposite.
    expect(gap(1, 3)).toBeCloseTo(Math.PI / 2);
    expect(gap(2, 4)).toBeCloseTo(Math.PI / 2);
  });
});
