import React from "react";
import { Path } from "react-native-svg";
import Animated, {
  SharedValue,
  useAnimatedProps,
} from "react-native-reanimated";
import { PaletteColor } from "@/src/common/utils/ColorPalette";
import {
  generateOrthogonalPath,
  LayoutPosition,
} from "@/src/pattern/graph/utils/GraphUtils";
import { ELIDED_DASH } from "@/src/pattern/graph/types/Constants";

const AnimatedPath = Animated.createAnimatedComponent(Path);

interface DraggedEdgeProps {
  /** The end that is not moving. */
  anchor: LayoutPosition;
  dragX: SharedValue<number>;
  dragY: SharedValue<number>;
  /** True when the dragged node is the edge's source rather than its target. */
  draggingFrom: boolean;
  elided: boolean;
  forceDirection?: boolean;
  palette: Record<PaletteColor, string>;
}

/**
 * An edge with one end under the finger.
 *
 * Only the dragged node's own edges are animated — a handful, whatever the
 * size of the graph — and the path string is rebuilt in a worklet on the UI
 * thread. Rebuilding every edge's `d` from JS per frame is exactly the jank
 * this design exists to avoid.
 */
const DraggedEdge: React.FC<DraggedEdgeProps> = ({
  anchor,
  dragX,
  dragY,
  draggingFrom,
  elided,
  forceDirection,
  palette,
}) => {
  const animatedProps = useAnimatedProps(() => {
    const moving = { x: dragX.get(), y: dragY.get() };
    const from = draggingFrom ? moving : anchor;
    const to = draggingFrom ? anchor : moving;
    return { d: generateOrthogonalPath(from, to, forceDirection) };
  });

  return (
    <AnimatedPath
      animatedProps={animatedProps}
      stroke={palette[PaletteColor.Primary]}
      strokeWidth={2}
      strokeDasharray={elided ? ELIDED_DASH : undefined}
      fill="none"
      markerEnd="url(#arrowhead-graph)"
      opacity={elided ? 0.4 : 0.6}
    />
  );
};

export default DraggedEdge;
