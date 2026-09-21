import React from "react";
import { G } from "react-native-svg";
import Animated, {
  SharedValue,
  useAnimatedProps,
} from "react-native-reanimated";
import PatternNode from "@/src/pattern/graph/PatternNode";
import { GraphNode } from "@/src/pattern/graph/model/GraphModel";
import { LayoutPosition } from "@/src/pattern/graph/utils/GraphUtils";
import { IPattern } from "@/src/pattern/types/IPatternList";
import { PaletteColor } from "@/src/common/utils/ColorPalette";

const AnimatedG = Animated.createAnimatedComponent(G);

interface DraggedNodeProps {
  node: GraphNode;
  /** Where the node sat before the drag started. */
  origin: LayoutPosition;
  dragX: SharedValue<number>;
  dragY: SharedValue<number>;
  palette: Record<PaletteColor, string>;
  onPress: (pattern: IPattern) => void;
}

/**
 * The node currently under the finger.
 *
 * Drawn at its original position inside a group that translates, rather than
 * by re-rendering it at new coordinates: `translate` is the one thing that
 * costs nothing per frame, and React never re-renders during the drag at all.
 */
const DraggedNode: React.FC<DraggedNodeProps> = ({
  node,
  origin,
  dragX,
  dragY,
  palette,
  onPress,
}) => {
  const animatedProps = useAnimatedProps(() => ({
    translateX: dragX.get() - origin.x,
    translateY: dragY.get() - origin.y,
  }));

  return (
    <AnimatedG animatedProps={animatedProps}>
      <PatternNode
        node={node}
        x={origin.x}
        y={origin.y}
        palette={palette}
        onPress={onPress}
      />
    </AnimatedG>
  );
};

export default DraggedNode;
