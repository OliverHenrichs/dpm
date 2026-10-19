import {
  distanceToNode,
  FOCUS_RADIUS,
  focusAtCentre,
  pickFocus,
  translationToCentre,
} from "@/src/pattern/graph/model/focus";
import { screenToContent } from "@/src/pattern/graph/model/graphCoordinates";
import { LayoutPosition } from "@/src/pattern/graph/utils/GraphUtils";
import { NODE_HEIGHT, NODE_WIDTH } from "@/src/pattern/graph/types/Constants";

const VIEWPORT = { width: 400, height: 800 };
const CONTENT = { width: 2000, height: 1600 };

const positions = (...entries: [number, number, number][]) =>
  new Map<number, LayoutPosition>(entries.map(([id, x, y]) => [id, { x, y }]));

describe("distanceToNode", () => {
  it("is zero anywhere inside the box", () => {
    expect(distanceToNode({ x: 10, y: -5 }, { x: 0, y: 0 })).toBe(0);
    expect(
      distanceToNode({ x: NODE_WIDTH / 2, y: NODE_HEIGHT / 2 }, { x: 0, y: 0 }),
    ).toBe(0);
  });

  it("measures to the nearest edge, not to the centre", () => {
    expect(
      distanceToNode({ x: NODE_WIDTH / 2 + 7, y: 0 }, { x: 0, y: 0 }),
    ).toBe(7);
  });

  it("measures to the corner diagonally", () => {
    expect(
      distanceToNode(
        { x: NODE_WIDTH / 2 + 3, y: NODE_HEIGHT / 2 + 4 },
        { x: 0, y: 0 },
      ),
    ).toBe(5);
  });
});

describe("pickFocus", () => {
  it("is null when nothing touches the circle", () => {
    expect(pickFocus({ x: 0, y: 0 }, 10, positions([1, 500, 500]), null)).toBe(
      null,
    );
  });

  it("takes a box that only touches the circle with its edge", () => {
    const edge = NODE_WIDTH / 2 + 9;

    expect(pickFocus({ x: 0, y: 0 }, 10, positions([1, edge, 0]), null)).toBe(
      1,
    );
  });

  it("takes the nearest of two that touch", () => {
    const near = NODE_WIDTH / 2 + 2;
    const far = -(NODE_WIDTH / 2 + 8);

    expect(
      pickFocus({ x: 0, y: 0 }, 10, positions([1, far, 0], [2, near, 0]), null),
    ).toBe(2);
  });

  it("keeps the current one while it still touches, even if another is nearer", () => {
    // Handing the focus to whichever is a pixel nearer would flicker between
    // the two on every frame of a slow pan.
    const near = NODE_WIDTH / 2 + 2;
    const far = -(NODE_WIDTH / 2 + 8);

    expect(
      pickFocus({ x: 0, y: 0 }, 10, positions([1, far, 0], [2, near, 0]), 1),
    ).toBe(1);
  });

  it("lets go of the current one once it no longer touches", () => {
    expect(
      pickFocus({ x: 0, y: 0 }, 10, positions([1, 500, 0], [2, 0, 0]), 1),
    ).toBe(2);
  });

  it("forgets a current id that is no longer drawn", () => {
    expect(pickFocus({ x: 0, y: 0 }, 10, positions([2, 0, 0]), 9)).toBe(2);
  });

  it("prefers the one drawn on top when two overlap the centre", () => {
    expect(
      pickFocus({ x: 0, y: 0 }, 10, positions([1, 0, 0], [2, 5, 0]), null),
    ).toBe(2);
  });
});

describe("focusAtCentre", () => {
  const node = { x: 1300, y: 900 };
  const drawn = positions([7, node.x, node.y]);

  it("finds the node the canvas has moved under the middle", () => {
    const transform = {
      scale: 0.5,
      ...translationToCentre(node, 0.5, CONTENT),
    };

    expect(focusAtCentre(VIEWPORT, transform, CONTENT, drawn, null)).toBe(7);
  });

  it("keeps the mark's reach the same on screen at any zoom", () => {
    // A box FOCUS_RADIUS - 1 screen pixels from the middle touches it at every
    // zoom; at FOCUS_RADIUS + 1 it does not.
    for (const scale of [0.25, 1, 3]) {
      const gap = (px: number) => NODE_WIDTH / 2 + px / scale;
      const centredOn = (x: number) => ({
        scale,
        ...translationToCentre({ x, y: node.y }, scale, CONTENT),
      });

      expect(
        focusAtCentre(
          VIEWPORT,
          centredOn(node.x - gap(FOCUS_RADIUS - 1)),
          CONTENT,
          drawn,
          null,
        ),
      ).toBe(7);
      expect(
        focusAtCentre(
          VIEWPORT,
          centredOn(node.x - gap(FOCUS_RADIUS + 1)),
          CONTENT,
          drawn,
          null,
        ),
      ).toBe(null);
    }
  });
});

describe("translationToCentre", () => {
  it("is the inverse of screenToContent at the viewport's centre", () => {
    for (const scale of [0.2, 1, 2.5]) {
      const target = { x: 321, y: 1234 };
      const transform = {
        scale,
        ...translationToCentre(target, scale, CONTENT),
      };
      const centre = screenToContent(
        VIEWPORT.width / 2,
        VIEWPORT.height / 2,
        VIEWPORT,
        transform,
        CONTENT,
      );

      expect(centre.x).toBeCloseTo(target.x);
      expect(centre.y).toBeCloseTo(target.y);
    }
  });
});
