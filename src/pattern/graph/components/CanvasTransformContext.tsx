import React, { createContext, ReactNode, useContext } from "react";
import { SharedValue, useSharedValue } from "react-native-reanimated";

/**
 * The canvas's live pan/zoom, as shared values.
 *
 * Exposed through context rather than props because the consumers are graph
 * nodes, several layers down inside an SVG. They are shared values, not state:
 * anything reading these does so from a worklet on the UI thread, and React
 * never re-renders while a gesture is in flight.
 */
export interface CanvasTransform {
  scale: SharedValue<number>;
  translateX: SharedValue<number>;
  translateY: SharedValue<number>;
  /** Measured on layout; 0 until then. Needed to invert a touch position. */
  viewportWidth: SharedValue<number>;
  viewportHeight: SharedValue<number>;
}

const CanvasTransformContext = createContext<CanvasTransform | null>(null);

export const CanvasTransformProvider: React.FC<{
  value: CanvasTransform;
  children: ReactNode;
}> = ({ value, children }) => (
  <CanvasTransformContext.Provider value={value}>
    {children}
  </CanvasTransformContext.Provider>
);

/**
 * Create the shared values a canvas transforms with.
 *
 * Created by the *caller* rather than inside `ZoomableCanvas` so that a
 * gesture built outside the canvas — the node drag, which needs the live zoom
 * to convert a screen delta into graph units — can read the same values. A
 * component cannot use the context it provides.
 */
export function useCanvasTransformValues(
  initialZoom: number,
  initialOffsetX: number,
  initialOffsetY: number,
): CanvasTransform {
  const scale = useSharedValue(initialZoom);
  const translateX = useSharedValue(initialOffsetX);
  const translateY = useSharedValue(initialOffsetY);
  const viewportWidth = useSharedValue(0);
  const viewportHeight = useSharedValue(0);
  return { scale, translateX, translateY, viewportWidth, viewportHeight };
}

/**
 * The enclosing canvas's transform, or null outside one.
 *
 * Null is a legitimate answer — the timeline draws the same nodes without a
 * zoomable canvas around them — so callers must handle it rather than assert.
 */
export function useCanvasTransform(): CanvasTransform | null {
  return useContext(CanvasTransformContext);
}
