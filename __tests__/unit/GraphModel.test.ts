import {
  buildAdjacency,
  buildDepthMap,
  collectDependents,
  collectPrerequisites,
  findCycles,
} from "@/src/pattern/graph/model/adjacency";
import {
  buildGraphModel,
  emptyGraphModel,
} from "@/src/pattern/graph/model/GraphModel";
import { IPattern } from "@/src/pattern/types/IPatternList";
import {
  createTestPattern,
  createTestPatternType,
} from "@/utils/testFactories";

const TYPE = createTestPatternType({ slug: "push", color: "#FF0000" });

const pattern = (id: number, prerequisites: number[] = []): IPattern =>
  createTestPattern(TYPE.id, { id, name: `P${id}`, prerequisites });

const adjacencyOf = (patterns: IPattern[]) => buildAdjacency(patterns);
const sorted = (set: Set<number>) => [...set].sort((a, b) => a - b);
const normaliseCycles = (cycles: number[][]) =>
  cycles.map((c) => [...c].sort((a, b) => a - b)).sort((a, b) => a[0] - b[0]);

describe("buildAdjacency", () => {
  it("indexes both directions", () => {
    const adjacency = adjacencyOf([pattern(1), pattern(2, [1])]);

    expect(adjacency.prereqsOf.get(2)).toEqual([1]);
    expect(adjacency.dependentsOf.get(1)).toEqual([2]);
  });

  it("gives every pattern an entry, even an isolated one", () => {
    const adjacency = adjacencyOf([pattern(1), pattern(2)]);

    expect(adjacency.prereqsOf.get(1)).toEqual([]);
    expect(adjacency.dependentsOf.get(2)).toEqual([]);
    expect(adjacency.ids).toEqual([1, 2]);
  });

  it("drops a prerequisite that matches no pattern", () => {
    // Consumers then never have to guard against a dangling id.
    const adjacency = adjacencyOf([pattern(2, [99])]);

    expect(adjacency.prereqsOf.get(2)).toEqual([]);
    expect(adjacency.dependentsOf.has(99)).toBe(false);
  });

  it("keeps the order patterns were given in", () => {
    expect(adjacencyOf([pattern(3), pattern(1), pattern(2)]).ids).toEqual([
      3, 1, 2,
    ]);
  });

  it("handles an empty set", () => {
    expect(adjacencyOf([]).ids).toEqual([]);
  });
});

describe("collectDependents", () => {
  it("walks forwards, transitively", () => {
    const adjacency = adjacencyOf([
      pattern(1),
      pattern(2, [1]),
      pattern(3, [2]),
    ]);

    expect(sorted(collectDependents(adjacency, 1))).toEqual([2, 3]);
  });

  it("does not walk backwards", () => {
    const adjacency = adjacencyOf([pattern(1), pattern(2, [1])]);

    expect(sorted(collectDependents(adjacency, 2))).toEqual([]);
  });

  it("terminates on a cycle", () => {
    const adjacency = adjacencyOf([pattern(1, [2]), pattern(2, [1])]);

    expect(sorted(collectDependents(adjacency, 1))).toEqual([1, 2]);
  });
});

describe("collectPrerequisites", () => {
  it("walks backwards, transitively", () => {
    const adjacency = adjacencyOf([
      pattern(1),
      pattern(2, [1]),
      pattern(3, [2]),
    ]);

    expect(sorted(collectPrerequisites(adjacency, 3))).toEqual([1, 2]);
  });

  it("terminates on a cycle", () => {
    const adjacency = adjacencyOf([pattern(1, [2]), pattern(2, [1])]);

    expect(sorted(collectPrerequisites(adjacency, 1))).toEqual([1, 2]);
  });
});

describe("findCycles", () => {
  it("finds none in a healthy chain", () => {
    expect(
      findCycles(adjacencyOf([pattern(1), pattern(2, [1]), pattern(3, [2])])),
    ).toEqual([]);
  });

  it("finds none in a diamond", () => {
    const patterns = [
      pattern(1),
      pattern(2, [1]),
      pattern(3, [1]),
      pattern(4, [2, 3]),
    ];

    expect(findCycles(adjacencyOf(patterns))).toEqual([]);
  });

  it("finds a two-node cycle", () => {
    const cycles = findCycles(adjacencyOf([pattern(1, [2]), pattern(2, [1])]));

    expect(normaliseCycles(cycles)).toEqual([[1, 2]]);
  });

  it("finds a longer cycle", () => {
    const cycles = findCycles(
      adjacencyOf([pattern(1, [3]), pattern(2, [1]), pattern(3, [2])]),
    );

    expect(normaliseCycles(cycles)).toEqual([[1, 2, 3]]);
  });

  it("counts a self-prerequisite as a cycle", () => {
    expect(normaliseCycles(findCycles(adjacencyOf([pattern(1, [1])])))).toEqual(
      [[1]],
    );
  });

  it("does not report a lone node as a cycle", () => {
    expect(findCycles(adjacencyOf([pattern(1)]))).toEqual([]);
  });

  it("finds two independent cycles", () => {
    const cycles = findCycles(
      adjacencyOf([
        pattern(1, [2]),
        pattern(2, [1]),
        pattern(10, [11]),
        pattern(11, [10]),
      ]),
    );

    expect(normaliseCycles(cycles)).toEqual([
      [1, 2],
      [10, 11],
    ]);
  });

  it("leaves healthy nodes hanging off a cycle out of it", () => {
    const cycles = findCycles(
      adjacencyOf([
        pattern(1, [2]),
        pattern(2, [1]),
        pattern(3, [1]),
        pattern(4, [3]),
      ]),
    );

    expect(normaliseCycles(cycles)).toEqual([[1, 2]]);
  });

  it("stays linear on a long chain rather than enumerating paths", () => {
    // The detector this replaces copied the visited set and path per edge, so
    // a densely linked graph was exponential in the number of distinct paths.
    // A 60-wide diamond lattice has astronomically many; this must be instant.
    const patterns: IPattern[] = [pattern(1)];
    for (let i = 2; i <= 60; i++) {
      patterns.push(pattern(i, i > 2 ? [i - 1, i - 2] : [1]));
    }

    const started = Date.now();
    expect(findCycles(adjacencyOf(patterns))).toEqual([]);
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it("does not blow the stack on a very long chain", () => {
    const patterns = [pattern(1)];
    for (let i = 2; i <= 5000; i++) patterns.push(pattern(i, [i - 1]));

    expect(findCycles(adjacencyOf(patterns))).toEqual([]);
  });
});

describe("buildDepthMap", () => {
  it("puts a prerequisite-free pattern at zero", () => {
    expect(buildDepthMap(adjacencyOf([pattern(1)])).get(1)).toBe(0);
  });

  it("counts along a chain", () => {
    const depth = buildDepthMap(
      adjacencyOf([pattern(1), pattern(2, [1]), pattern(3, [2])]),
    );

    expect([depth.get(1), depth.get(2), depth.get(3)]).toEqual([0, 1, 2]);
  });

  it("takes the longest path, not the shortest", () => {
    // 4 can be reached via 1→3→4 (depth 2) or 1→2→3→4 (depth 3).
    const depth = buildDepthMap(
      adjacencyOf([
        pattern(1),
        pattern(2, [1]),
        pattern(3, [1, 2]),
        pattern(4, [3]),
      ]),
    );

    expect(depth.get(4)).toBe(3);
  });

  it("treats a dangling prerequisite as no prerequisite", () => {
    expect(buildDepthMap(adjacencyOf([pattern(2, [99])])).get(2)).toBe(0);
  });

  it("gives every node in a cycle some depth rather than looping", () => {
    const depth = buildDepthMap(
      adjacencyOf([pattern(1, [2]), pattern(2, [1])]),
    );

    expect(depth.size).toBe(2);
    expect(typeof depth.get(1)).toBe("number");
  });

  it("does not blow the stack on a very long chain", () => {
    const patterns = [pattern(1)];
    for (let i = 2; i <= 5000; i++) patterns.push(pattern(i, [i - 1]));

    expect(buildDepthMap(adjacencyOf(patterns)).get(5000)).toBe(4999);
  });
});

describe("buildGraphModel", () => {
  it("wraps every pattern in a node, in order", () => {
    const model = buildGraphModel([pattern(1), pattern(2, [1])], [TYPE]);

    expect(model.nodes.map((n) => n.pattern.id)).toEqual([1, 2]);
  });

  it("resolves each node's colour from its type", () => {
    const model = buildGraphModel([pattern(1)], [TYPE]);

    expect(model.nodes[0].color).toBe("#FF0000");
  });

  it("leaves the colour undefined when the type is unknown", () => {
    const model = buildGraphModel(
      [createTestPattern("ghost", { id: 1 })],
      [TYPE],
    );

    expect(model.nodes[0].color).toBeUndefined();
  });

  it("marks a prerequisite-free pattern as foundational", () => {
    const model = buildGraphModel([pattern(1), pattern(2, [1])], [TYPE]);

    expect(model.nodes.map((n) => n.foundational)).toEqual([true, false]);
  });

  it("treats a pattern whose only prerequisite is missing as foundational", () => {
    // Nothing drawable comes before it, so the layout should anchor it.
    const model = buildGraphModel([pattern(2, [99])], [TYPE]);

    expect(model.nodes[0].foundational).toBe(true);
  });

  it("flags the nodes that sit in a cycle", () => {
    const model = buildGraphModel(
      [pattern(1, [2]), pattern(2, [1]), pattern(3)],
      [TYPE],
    );

    expect(
      model.nodes.filter((n) => n.inCycle).map((n) => n.pattern.id),
    ).toEqual([1, 2]);
  });

  it("produces one edge per resolvable prerequisite", () => {
    const model = buildGraphModel(
      [pattern(1), pattern(2, [1]), pattern(3, [1, 2])],
      [TYPE],
    );

    expect(model.edges).toHaveLength(3);
    expect(model.edges).toContainEqual({ from: 1, to: 2 });
    expect(model.edges).toContainEqual({ from: 2, to: 3 });
  });

  it("produces no edge for a dangling prerequisite", () => {
    expect(buildGraphModel([pattern(2, [99])], [TYPE]).edges).toEqual([]);
  });

  it("is empty for no patterns", () => {
    const model = buildGraphModel([], []);

    expect(model.nodes).toEqual([]);
    expect(model.edges).toEqual([]);
    expect(model.cycles).toEqual([]);
  });

  it("is deterministic for the same input", () => {
    const build = () =>
      buildGraphModel(
        [pattern(1), pattern(2, [1]), pattern(3, [1, 2])],
        [TYPE],
      );

    expect(JSON.stringify(build().edges)).toBe(JSON.stringify(build().edges));
  });
});

describe("emptyGraphModel", () => {
  it("is a usable model with nothing in it", () => {
    const model = emptyGraphModel();

    expect(model.nodes).toEqual([]);
    expect(model.edges).toEqual([]);
    expect(model.cycles).toEqual([]);
    expect(model.adjacency.ids).toEqual([]);
    expect(model.depthMap.size).toBe(0);
    expect(model.typeColorMap.size).toBe(0);
  });
});
