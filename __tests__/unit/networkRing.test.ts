import { IPattern } from "@/src/pattern/types/IPatternList";
import {
  calculateGraphLayout,
  getEllipseRadii,
} from "@/src/pattern/graph/utils/NetworkGraphUtils";
import { NODE_WIDTH } from "@/src/pattern/graph/types/Constants";
import {
  createTestPattern,
  createTestPatternType,
} from "@/utils/testFactories";

// A phone's canvas: useGraphLayout passes three widths by two heights.
const WIDTH = 411 * 3;
const HEIGHT = 900 * 2;

const TYPE = createTestPatternType({ slug: "push" });

function roots(count: number): IPattern[] {
  return Array.from({ length: count }, (_, i) =>
    createTestPattern(TYPE.id, { id: i + 1, name: `P${i + 1}` }),
  );
}

function closestPair(patterns: IPattern[]) {
  const points = [
    ...calculateGraphLayout(patterns, WIDTH, HEIGHT).positions.values(),
  ];
  let best = Infinity;
  points.forEach((a, i) =>
    points.slice(i + 1).forEach((b) => {
      best = Math.min(best, Math.hypot(a.x - b.x, a.y - b.y));
    }),
  );
  return best;
}

/**
 * The ring of roots used to take its size from the screen alone, so the four
 * roots of the six-figure West Coast Swing template sat about 600 px apart
 * and the list opened as four lonely boxes.
 */
describe("network root ring", () => {
  it("shrinks for a small list", () => {
    const small = getEllipseRadii(WIDTH, HEIGHT, 4);
    const screen = getEllipseRadii(WIDTH, HEIGHT, 1000);

    expect(small.ellipseRadiusY).toBeLessThan(screen.ellipseRadiusY / 2);
  });

  it("keeps the screen's aspect ratio", () => {
    const small = getEllipseRadii(WIDTH, HEIGHT, 4);
    const screen = getEllipseRadii(WIDTH, HEIGHT, 1000);

    expect(small.ellipseRadiusX / small.ellipseRadiusY).toBeCloseTo(
      screen.ellipseRadiusX / screen.ellipseRadiusY,
    );
  });

  it("is still capped by the screen for a large list", () => {
    expect(getEllipseRadii(WIDTH, HEIGHT, 30)).toEqual(
      getEllipseRadii(WIDTH, HEIGHT, 1000),
    );
  });

  it("grows with the number of roots", () => {
    expect(getEllipseRadii(WIDTH, HEIGHT, 8).ellipseRadiusY).toBeGreaterThan(
      getEllipseRadii(WIDTH, HEIGHT, 4).ellipseRadiusY,
    );
  });

  it.each([2, 3, 4, 8, 12])(
    "leaves clear space between neighbouring boxes with %i roots",
    (count) => {
      expect(closestPair(roots(count))).toBeGreaterThan(NODE_WIDTH * 1.5);
    },
  );
});
