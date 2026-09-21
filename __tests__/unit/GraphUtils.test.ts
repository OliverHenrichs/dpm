/**
 * What this file used to cover moved with the code.
 *
 * `generateEdges`, `calculatePrerequisiteDepthMap` and
 * `detectCircularDependencies` were replaced by the graph model: edges come
 * from `buildGraphModel`, depth from `buildDepthMap`, and cycles from
 * `findCycles` — all O(V + E), iterative, and computed once per model rather
 * than per render. `__tests__/unit/GraphModel.test.ts` covers all three far
 * more thoroughly than this did.
 *
 * What remains here is the path geometry, which is still its own concern.
 */
import { generateOrthogonalPath } from "@/src/pattern/graph/utils/GraphUtils";

describe("generateOrthogonalPath", () => {
  it("draws a path between two points", () => {
    const path = generateOrthogonalPath({ x: 0, y: 0 }, { x: 100, y: 50 });

    expect(typeof path).toBe("string");
    expect(path.startsWith("M")).toBe(true);
  });

  it("produces a different path for different endpoints", () => {
    const a = generateOrthogonalPath({ x: 0, y: 0 }, { x: 100, y: 50 });
    const b = generateOrthogonalPath({ x: 0, y: 0 }, { x: 200, y: 50 });

    expect(a).not.toBe(b);
  });

  it("is deterministic", () => {
    const build = () =>
      generateOrthogonalPath({ x: 10, y: 20 }, { x: 30, y: 40 });

    expect(build()).toBe(build());
  });
});
