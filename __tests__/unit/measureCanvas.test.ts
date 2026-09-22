import { measureCanvas } from "@/src/pattern/graph/model/canvasMetrics";
import { LayoutPosition } from "@/src/pattern/graph/utils/GraphUtils";

const VIEWPORT = { width: 400, height: 800 };

const positions = (
  points: Record<number, { x: number; y: number }>,
): Map<number, LayoutPosition> =>
  new Map(Object.entries(points).map(([id, p]) => [Number(id), p]));

const measure = (points: Record<number, { x: number; y: number }>) =>
  measureCanvas(positions(points), VIEWPORT.width, VIEWPORT.height);

/**
 * The canvas has to be measured from what is actually drawn, not from the
 * automatic layout. A manual layout replaces those positions, and a node
 * dragged past the automatic bounds would fall outside the SVG — where it is
 * not drawn at all, and cannot be dragged back.
 */
describe("measureCanvas", () => {
  it("is at least a few screens wide for a small graph", () => {
    const { svgWidth } = measure({ 1: { x: 200, y: 200 } });

    expect(svgWidth).toBeGreaterThanOrEqual(VIEWPORT.width);
  });

  it("grows to contain a node dragged past the default canvas", () => {
    const far = { 1: { x: 200, y: 200 }, 2: { x: 9000, y: 200 } };

    expect(measure(far).svgWidth).toBeGreaterThan(9000);
  });

  it("grows downwards too", () => {
    const far = { 1: { x: 200, y: 200 }, 2: { x: 200, y: 9000 } };

    expect(measure(far).svgHeight).toBeGreaterThan(9000);
  });

  it("centres on the middle of what is drawn", () => {
    const { contentCenterX, contentCenterY } = measure({
      1: { x: 200, y: 400 },
      2: { x: 600, y: 800 },
    });

    expect([contentCenterX, contentCenterY]).toEqual([400, 600]);
  });

  it("does not move the positions it was given", () => {
    // Re-normalising here would shift every node whenever one was dragged
    // past an edge, which reads as the whole graph jumping.
    const points = positions({ 1: { x: 1234, y: 567 } });

    measureCanvas(points, VIEWPORT.width, VIEWPORT.height);

    expect(points.get(1)).toEqual({ x: 1234, y: 567 });
  });

  it("fits a small graph at a readable zoom", () => {
    const { initialZoom } = measure({
      1: { x: 200, y: 200 },
      2: { x: 400, y: 200 },
    });

    expect(initialZoom).toBeGreaterThan(0.5);
  });

  it("zooms out for a wide one", () => {
    const { initialZoom } = measure({
      1: { x: 200, y: 200 },
      2: { x: 4000, y: 200 },
    });

    expect(initialZoom).toBeLessThan(0.5);
  });

  it("never zooms past the limits, however degenerate the graph", () => {
    const tiny = measure({ 1: { x: 200, y: 200 } });
    const huge = measure({ 1: { x: 0, y: 0 }, 2: { x: 1e6, y: 1e6 } });

    expect(tiny.initialZoom).toBeLessThanOrEqual(1);
    expect(huge.initialZoom).toBeGreaterThanOrEqual(0.15);
  });

  it("has sensible dimensions for an empty graph", () => {
    const { svgWidth, svgHeight, initialZoom } = measure({});

    expect(svgWidth).toBeGreaterThan(0);
    expect(svgHeight).toBeGreaterThan(0);
    expect(initialZoom).toBe(1);
  });
});
