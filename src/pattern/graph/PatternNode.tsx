import React from "react";
import { useUnistyles } from "react-native-unistyles";
import { Text as SvgText } from "react-native-svg";
import PatternNodeGroup from "@/src/pattern/graph/PatternNodeGroup";
import { IPattern } from "@/src/pattern/types/IPatternList";
import { NODE_HEIGHT, NODE_WIDTH } from "@/src/pattern/graph/types/Constants";
import { GraphNode } from "@/src/pattern/graph/model/GraphModel";
import { nodeBadges } from "@/src/pattern/graph/model/nodeBadges";
import NodeBadges from "@/src/pattern/graph/render/NodeBadges";
import NodeFrame from "@/src/pattern/graph/render/NodeFrame";
import { LEVEL_TINTS } from "@/src/pattern/graph/model/nodeFrame";

interface PatternNodeProps {
  node: GraphNode;
  x: number;
  y: number;
  /** Omit to make the node inert; see `PatternNodeGroup`. */
  onPress?: (pattern: IPattern) => void;
  /** Not in the sequence shown on the Map: drawn further back than a context node. */
  dimmed?: boolean;
}

/**
 * How far back a context node is drawn — one pulled in by a filter's chain
 * mode rather than matching it. Low enough to read as secondary, high enough
 * to still be legible, since the whole point is showing what leads to a match.
 */
const CONTEXT_OPACITY = 0.45;

/**
 * A figure outside the sequence shown on the Map. Further back than context, since the
 * sequence's figures must stand out at the zoom the network view opens at; still legible, as
 * the figures around a sequence are what someone looks for next.
 */
export const SEQUENCE_DIM_OPACITY = 0.3;

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
  onPress,
  dimmed,
}) => {
  const { theme } = useUnistyles();
  const { pattern, color, tint, foundational, isContext } = node;
  const typeColor = color ?? theme.colors.primary;
  const badges = nodeBadges(pattern);
  const { nodeTitle, nodeMeta } = theme.typography;

  // Clipboard's condensed face fits more of a name than After Hours' Manrope.
  const maxChars = theme.graph.nameChars;
  const displayName =
    pattern.name.length > maxChars
      ? pattern.name.substring(0, maxChars - 1) + "..."
      : pattern.name;
  // Centred on what is left beside Clipboard's type bar, not on the whole box.
  const textX = x + theme.graph.typeBarWidth / 2;

  return (
    <PatternNodeGroup
      onPress={onPress ? () => onPress(pattern) : undefined}
      opacity={
        dimmed ? SEQUENCE_DIM_OPACITY : isContext ? CONTEXT_OPACITY : undefined
      }
    >
      <NodeFrame
        x={x}
        y={y}
        width={NODE_WIDTH}
        height={NODE_HEIGHT}
        color={typeColor}
        tint={tint ?? LEVEL_TINTS.beginner}
        foundational={foundational}
      />

      <NodeBadges
        badges={badges}
        x={x}
        y={y}
        color={typeColor}
        foundational={foundational}
      />

      {/* Pattern name */}
      <SvgText
        x={textX}
        y={y - 5}
        fontFamily={nodeTitle.fontFamily}
        fontSize={nodeTitle.fontSize}
        fontWeight={nodeTitle.fontWeight}
        fill={theme.colors.text}
        textAnchor="middle"
      >
        {displayName}
      </SvgText>

      {/* Counts. In the text colour, not the muted one: over an advanced
          pattern's tint the muted grey fell under 4.5:1. */}
      <SvgText
        x={textX}
        y={y + 11}
        fontFamily={nodeMeta.fontFamily}
        fontSize={nodeMeta.fontSize}
        fontWeight={nodeMeta.fontWeight}
        fill={theme.colors.text}
        textAnchor="middle"
      >
        {`${pattern.counts} count`}
      </SvgText>
    </PatternNodeGroup>
  );
};

export default React.memo(PatternNode);
