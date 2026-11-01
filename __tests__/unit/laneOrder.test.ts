import { IPattern } from "@/src/pattern/types/IPatternList";
import { PatternType } from "@/src/pattern/types/PatternType";
import {
  laneAt,
  laneIndexAt,
  moveLane,
  orderLanes,
  reorderLanes,
} from "@/src/pattern/graph/utils/laneOrder";
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

describe("orderLanes with a manual order", () => {
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
  const oneEach = [
    pattern(1, push),
    pattern(2, pass),
    pattern(3, whip),
    pattern(4, tuck),
  ];

  it("follows the order the user dragged", () => {
    const order = [tuck.id, push.id, whip.id, pass.id];
    expect(slugs(orderLanes(types, oneEach, order))).toEqual([
      "tuck",
      "push",
      "whip",
      "pass",
    ]);
  });

  it("follows it even where the automatic order would keep linked types together", () => {
    // Push → Tuck is linked; the user put them apart anyway.
    const patterns = [...oneEach, pattern(5, tuck, [1])];
    expect(
      slugs(orderLanes(types, patterns, [push.id, pass.id, whip.id, tuck.id])),
    ).toEqual(["push", "pass", "whip", "tuck"]);
  });

  it("puts a type the order does not name at the end, in its automatic place", () => {
    // Pass and Whip were added after the drag. Automatically, Whip comes before Pass
    // (Whip → Tuck is the only link, pulling Whip towards Tuck's end).
    const patterns = [...oneEach, pattern(5, whip, [4])];
    const automatic = slugs(orderLanes(types, patterns)).filter(
      (slug) => slug === "pass" || slug === "whip",
    );
    expect(slugs(orderLanes(types, patterns, [tuck.id, push.id]))).toEqual([
      "tuck",
      "push",
      ...automatic,
    ]);
  });

  it("still gives no lane to a type with nothing shown", () => {
    const patterns = [pattern(1, push), pattern(2, whip)];
    expect(
      slugs(orderLanes(types, patterns, [tuck.id, whip.id, pass.id, push.id])),
    ).toEqual(["whip", "push"]);
  });

  it("ignores ids of types the list no longer has, and repeats", () => {
    expect(
      slugs(
        orderLanes(types, oneEach, [
          "gone",
          whip.id,
          whip.id,
          pass.id,
          tuck.id,
          push.id,
        ]),
      ),
    ).toEqual(["whip", "pass", "tuck", "push"]);
  });

  it("is the automatic order when the manual one is empty", () => {
    const patterns = [...oneEach, pattern(5, tuck, [1])];
    expect(orderLanes(types, patterns, [])).toEqual(
      orderLanes(types, patterns),
    );
  });
});

describe("reorderLanes", () => {
  const a = createTestPatternType({ slug: "a" });
  const b = createTestPatternType({ slug: "b" });
  const c = createTestPatternType({ slug: "c" });
  const d = createTestPatternType({ slug: "d" });
  const types = [a, b, c, d];
  const all = [a, b, c, d].map((type, i) =>
    createTestPattern(type.id, { id: i + 1 }),
  );

  it("saves every lane in the order shown", () => {
    expect(
      reorderLanes(types, all, undefined, [d.id, a.id, b.id, c.id]),
    ).toEqual([d.id, a.id, b.id, c.id]);
  });

  it("keeps the places of lanes a filter hides", () => {
    // B and D are hidden; A and C swap. B stays second, D last.
    expect(
      reorderLanes(types, all, [a.id, b.id, c.id, d.id], [c.id, a.id]),
    ).toEqual([c.id, b.id, a.id, d.id]);
  });

  it("puts types with no figure last, keeping their place from an earlier order", () => {
    const withoutB = all.filter((p) => p.typeId !== b.id);
    expect(
      reorderLanes(
        types,
        withoutB,
        [b.id, a.id, c.id, d.id],
        [d.id, a.id, c.id],
      ),
    ).toEqual([d.id, a.id, c.id, b.id]);
  });

  it("drops ids of types the list does not have", () => {
    expect(
      reorderLanes(
        types,
        all,
        ["gone", a.id],
        [b.id, a.id, "gone", c.id, d.id],
      ),
    ).toEqual([b.id, a.id, c.id, d.id]);
  });
});

describe("dragging a lane", () => {
  it("moves one entry and leaves the rest in order", () => {
    expect(moveLane(["a", "b", "c", "d"], 0, 2)).toEqual(["b", "c", "a", "d"]);
    expect(moveLane(["a", "b", "c", "d"], 3, 0)).toEqual(["d", "a", "b", "c"]);
    expect(moveLane(["a", "b"], 0, 5)).toEqual(["a", "b"]);
  });

  it("lands where the dragged lane's centre has passed the others' centres", () => {
    const centres = [50, 150, 300, 500];
    // Lane 0 picked up at 50.
    expect(laneIndexAt(centres, 0, 60)).toBe(0);
    expect(laneIndexAt(centres, 0, 151)).toBe(1);
    expect(laneIndexAt(centres, 0, 900)).toBe(3);
    // Lane 2 picked up at 300, dragged above everything.
    expect(laneIndexAt(centres, 2, -20)).toBe(0);
    expect(laneIndexAt(centres, 2, 120)).toBe(1);
    expect(laneIndexAt(centres, 2, 320)).toBe(2);
  });

  it("finds the lane under the finger by its band", () => {
    const bands = [
      { y: 0, height: 100 },
      { y: 100, height: 240 },
    ];
    expect(laneAt(bands, 0)).toBe(0);
    expect(laneAt(bands, 99)).toBe(0);
    expect(laneAt(bands, 100)).toBe(1);
    expect(laneAt(bands, 339)).toBe(1);
    expect(laneAt(bands, 340)).toBe(-1);
  });
});

describe("timeline lanes", () => {
  it("are laid out in the manual order", () => {
    const push = createTestPatternType({ slug: "push" });
    const tuck = createTestPatternType({ slug: "tuck" });
    const patterns = [
      createTestPattern(push.id, { id: 1 }),
      createTestPattern(tuck.id, { id: 2 }),
    ];
    const { swimlanes, positions } = calculateDynamicTimelineLayout(
      patterns,
      [push, tuck],
      1200,
      800,
      buildDepthMap(buildAdjacency(patterns)),
      [tuck.id, push.id],
    );
    expect(swimlanes.map((s) => s.label)).toEqual(["tuck", "push"]);
    expect(positions.get(2)!.y).toBeLessThan(positions.get(1)!.y);
  });

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
