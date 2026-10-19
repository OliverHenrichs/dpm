import React from "react";
import { G, Rect } from "react-native-svg";
import { useUnistyles } from "react-native-unistyles";
import { mix } from "@/src/common/theme/tokens";
import { FOUNDATIONAL_FRAME_INSET } from "@/src/pattern/graph/model/nodeFrame";

/** Width of the halo stroke, beyond the outline. Half of it shows; the box covers the rest. */
const GLOW_SPREAD = 6;
const GLOW_OPACITY = 0.16;

interface NodeFrameProps {
  /** Box centre. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** The pattern type's colour. */
  color: string;
  /** Opacity of the type colour over the surface; see `levelTint`. */
  tint: number;
  /** Foundational patterns carry a second, inner frame. */
  foundational: boolean;
}

/**
 * The box a pattern is drawn in on the Map, in the app style's shape (`theme.graph`).
 *
 * After Hours outlines a rounded box in the type colour, with a soft halo in its dark theme;
 * Clipboard draws a square box on the neutral rule with the type colour in a bar down its left
 * edge. The fill is one solid colour (the surface with the level tint mixed in) so edges do not
 * show through. `Legend` draws its samples with this too, so it always matches the graph.
 */
const NodeFrame: React.FC<NodeFrameProps> = ({
  x,
  y,
  width,
  height,
  color,
  tint,
  foundational,
}) => {
  const { theme } = useUnistyles();
  const { graph, colors } = theme;
  const left = x - width / 2;
  const top = y - height / 2;
  const radius = Math.min(graph.nodeRadius, height / 2);
  const outline = graph.nodeOutline === "type" ? color : colors.border;
  const bar = graph.typeBarWidth;
  const inset = FOUNDATIONAL_FRAME_INSET;

  return (
    <G>
      {graph.glow && (
        <Rect
          x={left}
          y={top}
          width={width}
          height={height}
          rx={radius}
          fill="none"
          stroke={color}
          strokeWidth={graph.nodeStrokeWidth + GLOW_SPREAD}
          strokeOpacity={GLOW_OPACITY}
        />
      )}
      <Rect
        x={left}
        y={top}
        width={width}
        height={height}
        rx={radius}
        fill={mix(colors.surface, color, tint)}
        stroke={outline}
        strokeWidth={graph.nodeStrokeWidth}
      />
      {/* Square ends: only Clipboard draws a bar, and its boxes are square. */}
      {bar > 0 && (
        <Rect x={left} y={top} width={bar} height={height} fill={color} />
      )}
      {foundational && (
        <Rect
          x={left + bar + inset}
          y={top + inset}
          width={width - bar - inset * 2}
          height={height - inset * 2}
          rx={Math.max(0, radius - inset)}
          fill="none"
          stroke={color}
          strokeWidth={1}
        />
      )}
    </G>
  );
};

export default NodeFrame;
