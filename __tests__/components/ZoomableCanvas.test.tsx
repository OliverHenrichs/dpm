import React from "react";
import { Text, View } from "react-native";
import ZoomableCanvas, {
  MAX_ZOOM,
  MIN_ZOOM,
} from "@/src/pattern/graph/components/ZoomableCanvas";
import {
  CanvasTransform,
  useCanvasTransform,
  useCanvasTransformValues,
} from "@/src/pattern/graph/components/CanvasTransformContext";
import {
  findGesture,
  Gesture,
  MockGesture,
  peekGestures,
} from "@/__mocks__/react-native-gesture-handler";
import { fireEvent, render, screen } from "@testing-library/react-native";

const VIEWPORT = { width: 400, height: 800 };
const CONTENT = { width: 2000, height: 1600 };

/**
 * Gestures are not something this environment can dispatch, so these drive the
 * handlers the canvas registered and assert on the transform it exposes. That
 * covers the arithmetic — deltas, focal points, clamping — which is where the
 * bugs that survive a device check live. Feel, arbitration and whether a tap
 * still reaches a node are verified on hardware; see AGENTS.md.
 */
let captured: CanvasTransform | null = null;

const TransformProbe: React.FC = () => {
  const transform = useCanvasTransform();
  // Captured in an effect, not during render: assigning to an outer variable
  // while rendering is exactly what the compiler rules forbid.
  React.useEffect(() => {
    captured = transform;
  }, [transform]);
  return <Text>probe</Text>;
};

/** Owns the shared values, as the network view does. */
const Harness: React.FC<{
  initialZoom: number;
  offsetX: number;
  offsetY: number;
  // The mock's gesture shape, cast at the boundary: the real prop type comes
  // from react-native-gesture-handler, which this environment replaces.
  extraGesture?: MockGesture;
}> = ({ initialZoom, offsetX, offsetY, extraGesture }) => {
  const transform = useCanvasTransformValues(initialZoom, offsetX, offsetY);
  return (
    <ZoomableCanvas
      contentWidth={CONTENT.width}
      contentHeight={CONTENT.height}
      initialZoom={initialZoom}
      initialOffsetX={offsetX}
      initialOffsetY={offsetY}
      transform={transform}
      extraGesture={
        extraGesture as unknown as React.ComponentProps<
          typeof ZoomableCanvas
        >["extraGesture"]
      }
    >
      <TransformProbe />
    </ZoomableCanvas>
  );
};

function renderCanvas(initialZoom = 1, offsetX = 0, offsetY = 0) {
  captured = null;
  render(
    <View testID="host">
      <Harness initialZoom={initialZoom} offsetX={offsetX} offsetY={offsetY} />
    </View>,
  );
  // The focal-point maths needs the viewport size, which arrives on layout.
  fireEvent(screen.getByText("probe").parent!, "layout", {
    nativeEvent: { layout: { ...VIEWPORT, x: 0, y: 0 } },
  });
  return captured!;
}

/** The viewport-sized View that carries onLayout is the canvas's own. */
function layoutViewport() {
  const detectorChild = screen.UNSAFE_getAllByType(View as never);
  for (const node of detectorChild) {
    if (typeof node.props.onLayout === "function") {
      fireEvent(node, "layout", {
        nativeEvent: { layout: { ...VIEWPORT, x: 0, y: 0 } },
      });
      return;
    }
  }
  throw new Error("no view with onLayout");
}

const rootGesture = (): MockGesture => peekGestures()[0];
const gestureOf = (type: string) => findGesture(rootGesture(), type)!;

const transform = () => ({
  scale: captured!.scale.get(),
  x: captured!.translateX.get(),
  y: captured!.translateY.get(),
});

describe("ZoomableCanvas", () => {
  describe("its initial transform", () => {
    it("opens at the zoom it was given", () => {
      renderCanvas(0.35);

      expect(captured!.scale.get()).toBe(0.35);
    });

    it("opens at the offsets it was given", () => {
      renderCanvas(1, 120, -40);

      expect([captured!.translateX.get(), captured!.translateY.get()]).toEqual([
        120, -40,
      ]);
    });

    it("exposes its transform to descendants", () => {
      renderCanvas();

      expect(captured).not.toBeNull();
    });
  });

  describe("panning", () => {
    it("moves the content by the gesture's delta", () => {
      renderCanvas(1);
      layoutViewport();

      gestureOf("pan").handlers.onChange({ changeX: 30, changeY: -15 });

      expect(transform()).toEqual({ scale: 1, x: 30, y: -15 });
    });

    it("accumulates across frames", () => {
      renderCanvas(1);
      layoutViewport();
      const pan = gestureOf("pan");

      pan.handlers.onChange({ changeX: 10, changeY: 10 });
      pan.handlers.onChange({ changeX: 5, changeY: -20 });

      expect(transform()).toEqual({ scale: 1, x: 15, y: -10 });
    });

    it("moves by screen pixels whatever the zoom", () => {
      // The offsets are applied before the scale in the transform array, so a
      // drag tracks the finger 1:1 rather than being multiplied by the zoom.
      renderCanvas(0.25);
      layoutViewport();

      gestureOf("pan").handlers.onChange({ changeX: 40, changeY: 0 });

      expect(transform().x).toBe(40);
    });

    it("averages touches, so a second finger does not jolt the content", () => {
      renderCanvas();

      expect(gestureOf("pan").config.averageTouches).toBe(true);
    });
  });

  describe("pinching", () => {
    const pinchBy = (factor: number, focalX: number, focalY: number) => {
      const pinch = gestureOf("pinch");
      pinch.handlers.onStart({});
      pinch.handlers.onUpdate({ scale: factor, focalX, focalY });
    };

    it("scales by the gesture's factor", () => {
      renderCanvas(1);
      layoutViewport();

      pinchBy(2, VIEWPORT.width / 2, VIEWPORT.height / 2);

      expect(transform().scale).toBe(2);
    });

    it("leaves the viewport centre alone when pinching on it", () => {
      renderCanvas(1);
      layoutViewport();

      pinchBy(2, VIEWPORT.width / 2, VIEWPORT.height / 2);

      expect([transform().x, transform().y]).toEqual([0, 0]);
    });

    it("keeps the point under the fingers in place", () => {
      renderCanvas(1);
      layoutViewport();

      // 100px right of centre: doubling must push it twice as far out.
      pinchBy(2, VIEWPORT.width / 2 + 100, VIEWPORT.height / 2);

      expect(transform().x).toBe(-100);
    });

    it("composes with a pan instead of fighting it", () => {
      // Both write translate; pinch works from the live value rather than one
      // captured at gesture start, so a two-finger drag does not snap back.
      renderCanvas(1);
      layoutViewport();

      gestureOf("pan").handlers.onChange({ changeX: 50, changeY: 0 });
      pinchBy(2, VIEWPORT.width / 2, VIEWPORT.height / 2);

      expect(transform().x).toBe(100);
    });

    it("refuses to zoom past the maximum", () => {
      renderCanvas(1);
      layoutViewport();

      pinchBy(100, VIEWPORT.width / 2, VIEWPORT.height / 2);

      expect(transform().scale).toBe(MAX_ZOOM);
    });

    it("refuses to zoom past the minimum", () => {
      renderCanvas(1);
      layoutViewport();

      pinchBy(0.001, VIEWPORT.width / 2, VIEWPORT.height / 2);

      expect(transform().scale).toBe(MIN_ZOOM);
    });

    it("treats the reported scale as cumulative, not per-frame", () => {
      renderCanvas(1);
      layoutViewport();
      const pinch = gestureOf("pinch");
      const centre = {
        focalX: VIEWPORT.width / 2,
        focalY: VIEWPORT.height / 2,
      };

      pinch.handlers.onStart({});
      pinch.handlers.onUpdate({ scale: 2, ...centre });
      pinch.handlers.onUpdate({ scale: 4, ...centre });

      // 4 cumulative, not 2 × 4.
      expect(transform().scale).toBe(4);
    });
  });

  describe("gesture composition", () => {
    it("lets pan and pinch run together", () => {
      renderCanvas();

      expect(findGesture(rootGesture(), "simultaneous")).toBeDefined();
    });

    it("offers no double-tap-to-zoom", () => {
      // The graph's node tap lives in this gesture system now, and the two
      // cannot both be fast: a single tap would have to wait for a double tap
      // to fail before it could open a pattern.
      renderCanvas();

      expect(findGesture(rootGesture(), "tap")).toBeUndefined();
    });

    it("is just pan and pinch when nothing else is raced with it", () => {
      renderCanvas();

      expect(rootGesture().type).toBe("simultaneous");
    });

    it("races a caller's gesture ahead of its own", () => {
      // The node drag goes here. Racing rather than Exclusive: the drag
      // activates on a long press and the canvas pan on movement, so whichever
      // the user actually did wins immediately.
      captured = null;
      const extra = Gesture.LongPress();
      render(
        <View testID="host">
          <Harness
            initialZoom={1}
            offsetX={0}
            offsetY={0}
            extraGesture={extra}
          />
        </View>,
      );

      expect(rootGesture().type).toBe("race");
      expect(findGesture(rootGesture(), "longPress")).toBeDefined();
    });
  });
});
