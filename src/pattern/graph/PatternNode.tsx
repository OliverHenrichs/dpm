import React from "react";
import { Rect, Text as SvgText } from "react-native-svg";
import PatternNodeGroup from "@/src/pattern/graph/PatternNodeGroup";
import { PatternLevel } from "@/src/pattern/types/PatternLevel";
import { IPattern } from "@/src/pattern/types/IPatternList";
import { PaletteColor } from "@/src/common/utils/ColorPalette";
import { NODE_HEIGHT, NODE_WIDTH } from "@/src/pattern/graph/types/Constants";
import { GraphNode } from "@/src/pattern/graph/model/GraphModel";

interface PatternNodeProps {
  node: GraphNode;
  x: number;
  y: number;
  palette: Record<PaletteColor, string>;
  onPress: (pattern: IPattern) => void;
}

/**
 * How far back a context node is drawn — one pulled in by a filter's chain
 * mode rather than matching it. Low enough to read as secondary, high enough
 * to still be legible, since the whole point is showing what leads to a match.
 */
const CONTEXT_OPACITY = 0.45;

/** Denser fill for harder patterns, so level reads at a glance. */
function backgroundOpacity(level: string | undefined): number {
  switch (level) {
    case PatternLevel.INTERMEDIATE:
    case "intermediate":
      return 0.5;
    case PatternLevel.ADVANCED:
    case "advanced":
      return 0.7;
    default:
      return 0.3;
  }
}

/**
 * One node in either graph view.
 *
 * Takes a `GraphNode` rather than a bare pattern plus a colour map: the type
 * colour and whether the pattern is foundational are both decided once in the
 * model. It used to declare its own structural prop type — which included a
 * `type?: any` — and every call site cast to `any` to satisfy it.
 */
const PatternNode: React.FC<PatternNodeProps> = ({
  node,
  x,
  y,
  palette,
  onPress,
}) => {
  const { pattern, color, foundational, isContext } = node;
  const borderColor = color ?? palette[PaletteColor.Primary];
  const bgOpacity = backgroundOpacity(pattern.level);

  const displayName =
    pattern.name.length > 12
      ? pattern.name.substring(0, 11) + "..."
      : pattern.name;

  return (
    <PatternNodeGroup
      onPress={() => onPress(pattern)}
      opacity={isContext ? CONTEXT_OPACITY : undefined}
    >
      {/* Main background */}
      <Rect
        x={x - NODE_WIDTH / 2}
        y={y - NODE_HEIGHT / 2}
        width={NODE_WIDTH}
        height={NODE_HEIGHT}
        fill={palette[PaletteColor.PrimaryText]}
        fillOpacity={bgOpacity}
        stroke={borderColor}
        strokeWidth={2}
        rx={4}
      />

      {/* Double border for foundational patterns */}
      {foundational && (
        <Rect
          x={x - NODE_WIDTH / 2 + 3}
          y={y - NODE_HEIGHT / 2 + 3}
          width={NODE_WIDTH - 6}
          height={NODE_HEIGHT - 6}
          fill="none"
          stroke={borderColor}
          strokeWidth={1}
          rx={2}
        />
      )}

      {/* Pattern name */}
      <SvgText
        x={x}
        y={y - 5}
        fontSize={12}
        fontWeight="bold"
        fill={palette[PaletteColor.PrimaryText]}
        textAnchor="middle"
      >
        {displayName}
      </SvgText>

      {/* Counts */}
      <SvgText
        x={x}
        y={y + 11}
        fontSize={10}
        fill={palette[PaletteColor.SecondaryText]}
        textAnchor="middle"
      >
        {`${pattern.counts} count`}
      </SvgText>
    </PatternNodeGroup>
  );
};

export default React.memo(PatternNode);
