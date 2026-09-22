import React from "react";
import { Text } from "react-native";
import { render } from "@testing-library/react-native";
import * as Haptics from "expo-haptics";
import {
  DRAG_ACTIVATION_MS,
  useNodeDrag,
} from "@/src/pattern/graph/hooks/useNodeDrag";
import { useCanvasTransformValues } from "@/src/pattern/graph/components/CanvasTransformContext";
import { LayoutPosition } from "@/src/pattern/graph/utils/GraphUtils";
import {
  MAX_GRAPH_COORDINATE,
  MIN_GRAPH_COORDINATE,
} from "@/src/pattern/graph/types/Constants";
import {
  findGesture,
  MockGesture,
} from "@/__mocks__/react-native-gesture-handler";

const VIEWPORT = { width: 400, height: 800 };
const CONTENT = { width: 2000, height: 1600 };

const POSITIONS = new Map<number, LayoutPosition>([
  [1, { x: 1000, y: 800 }],
  [2, { x: 1400, y: 800 }],
]);

/**
 * Gestures cannot be dispatched here, so these drive the handlers the hook
 * registered. That covers what a device check cannot tell you precisely —
 * whether the node lands where the finger did, at any zoom — while leaving
 * arbitration and feel to hardware.
 */
interface Harness {
  gesture: MockGesture;
  pan: MockGesture;
  tap: MockGesture;
  moved: jest.Mock;
  tapped: jest.Mock;
  draggingId: () => number | null;
  transform: ReturnType<typeof useCanvasTransformValues>;
}

function renderDrag(
  { zoom = 1, enabled = true } = {},
  positions = POSITIONS,
): Harness {
  const moved = jest.fn();
  const tapped = jest.fn();
  const Probe: React.FC = () => {
    const transform = useCanvasTransformValues(zoom, 0, 0);
    transform.viewportWidth.set(VIEWPORT.width);
    transform.viewportHeight.set(VIEWPORT.height);
    const drag = useNodeDrag(
      transform,
      positions,
      CONTENT.width,
      CONTENT.height,
      moved,
      tapped,
      enabled,
    );
    // Read during render on purpose: the harness needs the current value, and
    // an effect would lag a synchronous handler call by a tick.
    const composed = drag.gesture as unknown as MockGesture;
    harness = {
      gesture: composed,
      pan: findGesture(composed, "pan")!,
      tap: findGesture(composed, "tap")!,
      moved,
      tapped,
      draggingId: () => drag.draggingId,
      transform,
    };
    return <Text>probe</Text>;
  };

  let harness: Harness | null = null;
  render(<Probe />);
  return harness!;
}

/** Screen coordinates of a node, at identity transform. */
const screenAt = (position: LayoutPosition) => ({
  x: position.x - CONTENT.width / 2 + VIEWPORT.width / 2,
  y: position.y - CONTENT.height / 2 + VIEWPORT.height / 2,
});

const startOn = (h: Harness, id: number) =>
  h.pan.handlers.onStart(screenAt(POSITIONS.get(id)!));

const move = (h: Harness, changeX: number, changeY: number) =>
  h.pan.handlers.onChange({ changeX, changeY });

const release = (h: Harness) => {
  h.pan.handlers.onEnd({});
  h.pan.handlers.onFinalize({}, true);
};

describe("useNodeDrag", () => {
  describe("how it activates", () => {
    it("waits for a long press, so an ordinary drag still pans", () => {
      const h = renderDrag();

      expect(h.pan.config.activateAfterLongPress).toBe(DRAG_ACTIVATION_MS);
    });

    it("is disabled when there is nothing to drag", () => {
      const h = renderDrag({ enabled: false });

      expect(h.pan.config.enabled).toBe(false);
    });
  });

  describe("picking a node up", () => {
    it("picks the node under the touch", () => {
      const h = renderDrag();

      startOn(h, 2);
      move(h, 10, 0);
      release(h);

      expect(h.moved).toHaveBeenCalledWith(2, { x: 1410, y: 800 });
    });

    it("tells the user it has hold of something", () => {
      const h = renderDrag();

      startOn(h, 1);

      expect(Haptics.impactAsync).toHaveBeenCalled();
    });

    it("moves nothing when the touch misses every node", () => {
      const h = renderDrag();

      h.pan.handlers.onStart({ x: 5, y: 5 });
      move(h, 40, 0);
      release(h);

      expect(h.moved).not.toHaveBeenCalled();
    });

    it("pans the canvas instead when the touch misses", () => {
      // The drag has already won the race, so the canvas pan will not fire.
      // Doing nothing at all would look like the app had frozen.
      const h = renderDrag();

      h.pan.handlers.onStart({ x: 5, y: 5 });
      move(h, 40, -20);

      expect([
        h.transform.translateX.get(),
        h.transform.translateY.get(),
      ]).toEqual([40, -20]);
    });
  });

  describe("following the finger", () => {
    it("tracks it one-to-one at 1:1", () => {
      const h = renderDrag();

      startOn(h, 1);
      move(h, 30, -40);
      release(h);

      expect(h.moved).toHaveBeenCalledWith(1, { x: 1030, y: 760 });
    });

    it("keeps up when the canvas is zoomed in", () => {
      // Without dividing by the zoom the node lags the finger.
      const h = renderDrag({ zoom: 2 });

      h.pan.handlers.onStart({
        x: (1000 - CONTENT.width / 2) * 2 + VIEWPORT.width / 2,
        y: (800 - CONTENT.height / 2) * 2 + VIEWPORT.height / 2,
      });
      move(h, 40, 0);
      release(h);

      expect(h.moved).toHaveBeenCalledWith(1, { x: 1020, y: 800 });
    });

    it("does not outrun it when the canvas is zoomed out", () => {
      const h = renderDrag({ zoom: 0.5 });

      h.pan.handlers.onStart({
        x: (1000 - CONTENT.width / 2) * 0.5 + VIEWPORT.width / 2,
        y: (800 - CONTENT.height / 2) * 0.5 + VIEWPORT.height / 2,
      });
      move(h, 40, 0);
      release(h);

      expect(h.moved).toHaveBeenCalledWith(1, { x: 1080, y: 800 });
    });

    it("accumulates across frames", () => {
      const h = renderDrag();

      startOn(h, 1);
      move(h, 10, 10);
      move(h, 10, 10);
      release(h);

      expect(h.moved).toHaveBeenCalledWith(1, { x: 1020, y: 820 });
    });

    it("cannot be dragged off the near edge of the canvas", () => {
      // A node at a negative coordinate is outside the SVG and simply not
      // drawn, so there would be no way to drag it back.
      const h = renderDrag();

      startOn(h, 1);
      move(h, -1e9, -1e9);
      release(h);

      expect(h.moved).toHaveBeenCalledWith(1, {
        x: MIN_GRAPH_COORDINATE,
        y: MIN_GRAPH_COORDINATE,
      });
    });

    it("cannot be dragged outside the drawable box", () => {
      const h = renderDrag();

      startOn(h, 1);
      move(h, 1e9, 1e9);
      release(h);

      expect(h.moved).toHaveBeenCalledWith(1, {
        x: MAX_GRAPH_COORDINATE,
        y: MAX_GRAPH_COORDINATE,
      });
    });

    it("leaves the canvas where it was", () => {
      const h = renderDrag();

      startOn(h, 1);
      move(h, 50, 50);

      expect([
        h.transform.translateX.get(),
        h.transform.translateY.get(),
      ]).toEqual([0, 0]);
    });
  });

  describe("letting go", () => {
    it("persists the new position once, not per frame", () => {
      const h = renderDrag();

      startOn(h, 1);
      move(h, 10, 0);
      move(h, 10, 0);
      release(h);

      expect(h.moved).toHaveBeenCalledTimes(1);
    });

    it("persists nothing when the gesture is cancelled", () => {
      const h = renderDrag();

      startOn(h, 1);
      move(h, 10, 0);
      h.pan.handlers.onFinalize({}, false);

      expect(h.moved).not.toHaveBeenCalled();
    });

    it("forgets the node, so the next miss does not move it", () => {
      const h = renderDrag();

      startOn(h, 1);
      release(h);
      h.moved.mockClear();

      h.pan.handlers.onStart({ x: 5, y: 5 });
      move(h, 10, 0);
      release(h);

      expect(h.moved).not.toHaveBeenCalled();
    });
  });

  describe("tapping", () => {
    it("opens the node under the touch", () => {
      // Taps come through the gesture system, not each node's own SVG press
      // handler — that handler claims the touch and stopped the drag above
      // from ever activating.
      const h = renderDrag();

      h.tap.handlers.onEnd(screenAt(POSITIONS.get(2)!));

      expect(h.tapped).toHaveBeenCalledWith(2);
    });

    it("does nothing when the tap misses every node", () => {
      const h = renderDrag();

      h.tap.handlers.onEnd({ x: 5, y: 5 });

      expect(h.tapped).not.toHaveBeenCalled();
    });

    it("is disabled along with the drag when there is nothing to tap", () => {
      const h = renderDrag({ enabled: false });

      expect(h.tap.config.enabled).toBe(false);
    });

    it("does not move anything", () => {
      const h = renderDrag();

      h.tap.handlers.onEnd(screenAt(POSITIONS.get(1)!));

      expect(h.moved).not.toHaveBeenCalled();
    });
  });
});
