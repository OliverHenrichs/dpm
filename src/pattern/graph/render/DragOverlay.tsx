import React from "react";
import { StyleSheet } from "react-native";
import Animated, {
  SharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";
import Svg from "react-native-svg";
import PatternNode from "@/src/pattern/graph/PatternNode";
import { GraphNode } from "@/src/pattern/graph/model/GraphModel";
import { LayoutPosition } from "@/src/pattern/graph/utils/GraphUtils";
import { PaletteColor } from "@/src/common/utils/ColorPalette";
import { NODE_HEIGHT, NODE_WIDTH } from "@/src/pattern/graph/types/Constants";

/** Room for the node's border and its lift, so neither is clipped. */
const PADDING = 12;
const BOX_WIDTH = NODE_WIDTH + PADDING * 2;
const BOX_HEIGHT = NODE_HEIGHT + PADDING * 2;
/** Picked up, so slightly larger — the one cue that does not need hardware. */
const LIFT_SCALE = 1.12;

interface DragOverlayProps {
  node: GraphNode;
  /** Where the node sits in the graph; the overlay is anchored here. */
  origin: LayoutPosition;
  dragX: SharedValue<number>;
  dragY: SharedValue<number>;
  palette: Record<PaletteColor, string>;
}

/**
 * The node under the finger, drawn in its own view above the graph.
 *
 * Not an animated `<G>` inside the main `<Svg>`, which is what this replaces:
 * animating an SVG group's transform props made the node disappear for the
 * duration of the drag on device, while its edges followed correctly. A plain
 * `Animated.View` transform is the one thing that is reliable everywhere, so
 * the node is lifted out into a small SVG of its own and the *view* moves.
 *
 * The lift also matters on its own account. Haptics are off system-wide for
 * many people and silent on a lot of Android hardware, so a vibration cannot
 * be the only sign that a node has been picked up.
 */
const DragOverlay: React.FC<DragOverlayProps> = ({
  node,
  origin,
  dragX,
  dragY,
  palette,
}) => {
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: dragX.get() - origin.x },
      { translateY: dragY.get() - origin.y },
      { scale: LIFT_SCALE },
    ],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.overlay,
        { left: origin.x - BOX_WIDTH / 2, top: origin.y - BOX_HEIGHT / 2 },
        style,
      ]}
    >
      <Svg width={BOX_WIDTH} height={BOX_HEIGHT}>
        <PatternNode
          node={node}
          x={BOX_WIDTH / 2}
          y={BOX_HEIGHT / 2}
          palette={palette}
        />
      </Svg>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    width: BOX_WIDTH,
    height: BOX_HEIGHT,
  },
});

export default DragOverlay;
