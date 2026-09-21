import React, { createContext, ReactNode, useContext } from "react";
import { SharedValue } from "react-native-reanimated";

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
 * The enclosing canvas's transform, or null outside one.
 *
 * Null is a legitimate answer — the timeline draws the same nodes without a
 * zoomable canvas around them — so callers must handle it rather than assert.
 */
export function useCanvasTransform(): CanvasTransform | null {
  return useContext(CanvasTransformContext);
}
