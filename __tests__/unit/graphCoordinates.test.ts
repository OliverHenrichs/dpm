import {
  findNodeAt,
  screenDeltaToContent,
  screenToContent,
} from "@/src/pattern/graph/model/graphCoordinates";
import { LayoutPosition } from "@/src/pattern/graph/utils/GraphUtils";
import { NODE_HEIGHT, NODE_WIDTH } from "@/src/pattern/graph/types/Constants";

const VIEWPORT = { width: 400, height: 800 };
const CONTENT = { width: 2000, height: 1600 };
const IDENTITY = { scale: 1, translateX: 0, translateY: 0 };

const at = (
  screenX: number,
  screenY: number,
  transform = IDENTITY,
): LayoutPosition =>
  screenToContent(screenX, screenY, VIEWPORT, transform, CONTENT);

describe("screenToContent", () => {
  it("maps the viewport centre to the content centre", () => {
    expect(at(VIEWPORT.width / 2, VIEWPORT.height / 2)).toEqual({
      x: CONTENT.width / 2,
      y: CONTENT.height / 2,
    });
  });

  it("maps an offset from the centre one-to-one at 1:1", () => {
    expect(at(VIEWPORT.width / 2 + 100, VIEWPORT.height / 2 - 50)).toEqual({
      x: CONTENT.width / 2 + 100,
      y: CONTENT.height / 2 - 50,
    });
  });

  it("undoes the zoom", () => {
    // Zoomed out to a quarter, 100 screen pixels is 400 graph units.
    const zoomedOut = { ...IDENTITY, scale: 0.25 };

    expect(at(VIEWPORT.width / 2 + 100, VIEWPORT.height / 2, zoomedOut).x).toBe(
      CONTENT.width / 2 + 400,
    );
  });

  it("undoes the pan", () => {
    const panned = { ...IDENTITY, translateX: 60 };

    expect(at(VIEWPORT.width / 2, VIEWPORT.height / 2, panned).x).toBe(
      CONTENT.width / 2 - 60,
    );
  });

  it("undoes pan and zoom together, in the right order", () => {
    // The canvas translates then scales, so the translation is in screen
    // pixels and must be removed before dividing by the zoom.
    const both = { scale: 2, translateX: 100, translateY: 0 };

    expect(at(VIEWPORT.width / 2 + 300, VIEWPORT.height / 2, both).x).toBe(
      CONTENT.width / 2 + 100,
    );
  });

  it("survives a zero scale rather than returning infinity", () => {
    const degenerate = { ...IDENTITY, scale: 0 };

    expect(Number.isFinite(at(0, 0, degenerate).x)).toBe(true);
  });

  it("round-trips with the transform the canvas applies", () => {
    const transform = { scale: 1.75, translateX: -40, translateY: 25 };
    const contentPoint = { x: 1234, y: 567 };

    // Forward: the transform the canvas actually renders with.
    const screenX =
      (contentPoint.x - CONTENT.width / 2) * transform.scale +
      transform.translateX +
      VIEWPORT.width / 2;
    const screenY =
      (contentPoint.y - CONTENT.height / 2) * transform.scale +
      transform.translateY +
      VIEWPORT.height / 2;

    const back = at(screenX, screenY, transform);

    expect(back.x).toBeCloseTo(contentPoint.x);
    expect(back.y).toBeCloseTo(contentPoint.y);
  });
});

describe("screenDeltaToContent", () => {
  it("is unchanged at 1:1", () => {
    expect(screenDeltaToContent(40, 1)).toBe(40);
  });

  it("is larger when zoomed out", () => {
    // Otherwise a dragged node outruns the finger.
    expect(screenDeltaToContent(40, 0.5)).toBe(80);
  });

  it("is smaller when zoomed in", () => {
    // Otherwise a dragged node lags the finger.
    expect(screenDeltaToContent(40, 2)).toBe(20);
  });

  it("survives a zero scale", () => {
    expect(screenDeltaToContent(40, 0)).toBe(40);
  });
});

describe("findNodeAt", () => {
  const positions = new Map<number, LayoutPosition>([
    [1, { x: 0, y: 0 }],
    [2, { x: 500, y: 500 }],
  ]);

  it("finds a node under its centre", () => {
    expect(findNodeAt({ x: 0, y: 0 }, positions)).toBe(1);
  });

  it("finds a node anywhere inside its box", () => {
    expect(
      findNodeAt({ x: NODE_WIDTH / 2 - 1, y: NODE_HEIGHT / 2 - 1 }, positions),
    ).toBe(1);
  });

  it("finds nothing just outside the box", () => {
    expect(findNodeAt({ x: NODE_WIDTH / 2 + 1, y: 0 }, positions)).toBeNull();
  });

  it("finds nothing in empty space", () => {
    expect(findNodeAt({ x: 250, y: 250 }, positions)).toBeNull();
  });

  it("picks the right node when there are several", () => {
    expect(findNodeAt({ x: 500, y: 500 }, positions)).toBe(2);
  });

  it("picks the topmost when two overlap", () => {
    // Paint order: the one the user can see is the one drawn last.
    const overlapping = new Map<number, LayoutPosition>([
      [1, { x: 0, y: 0 }],
      [2, { x: 5, y: 5 }],
    ]);

    expect(findNodeAt({ x: 0, y: 0 }, overlapping)).toBe(2);
  });

  it("finds nothing in an empty graph", () => {
    expect(findNodeAt({ x: 0, y: 0 }, new Map())).toBeNull();
  });
});
