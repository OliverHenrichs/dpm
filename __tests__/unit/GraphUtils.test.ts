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
import { arrowheadGeometry } from "@/src/pattern/graph/render/edgeStyle";
import { NODE_WIDTH } from "@/src/pattern/graph/types/Constants";

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

describe("arrowheads", () => {
  // After Hours draws edges 2 wide, Clipboard 1.5.
  it.each([2, 1.5])("end on the box's edge at edge width %s", (edgeWidth) => {
    const target = { x: 500, y: 0 };
    const path = generateOrthogonalPath({ x: 0, y: 0 }, target, true);
    const pathEndX = Number(
      path
        .trim()
        .split(/[\s,]+/)
        .at(-2),
    );

    // A marker's units are multiples of the stroke width.
    const tipX = pathEndX + arrowheadGeometry(edgeWidth).length * edgeWidth;

    expect(tipX).toBeCloseTo(target.x - NODE_WIDTH / 2);
  });
});
