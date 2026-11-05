import React from "react";
import { Defs, G, Marker, Path, Polygon, Rect, Text } from "react-native-svg";
import { useUnistyles } from "react-native-unistyles";
import { LayoutPosition } from "@/src/pattern/graph/utils/GraphUtils";
import {
  badgeLabel,
  hopPath,
  SequenceOverlay,
} from "@/src/pattern/graph/model/sequenceOverlay";
import { arrowheadGeometry } from "@/src/pattern/graph/render/edgeStyle";
import { NODE_HEIGHT, NODE_WIDTH } from "@/src/pattern/graph/types/Constants";

/** The sequence's arrows: dashed, so they never read as a prerequisite edge. */
export const SEQUENCE_DASH = "7 5";
/** Thicker than an edge, which sits dimmed underneath. */
const SEQUENCE_WIDTH = 2.5;
const BADGE_HEIGHT = 18;
/** Roughly a digit's advance in the badge's font, for sizing the pill to its numbers. */
const BADGE_CHAR = 6.6;
const BADGE_PAD = 6;
export const SEQUENCE_ARROW_ID = "arrowhead-sequence";

interface SequenceLayerProps {
  overlay: SequenceOverlay;
  positions: Map<number, LayoutPosition>;
  /** The node being dragged in the network view: its arrows and badge wait for the drop. */
  draggingId?: number | null;
}

/**
 * A shown sequence over either view (`model/sequenceOverlay.ts`): the arrows from figure to
 * figure in dancing order, and on each figure a pill with its step numbers, both in the accent.
 * Drawn after the nodes, so the arrows run over the boxes they pass rather than under them.
 * Inert: taps go to the nodes as ever.
 */
const SequenceLayer: React.FC<SequenceLayerProps> = ({
  overlay,
  positions,
  draggingId,
}) => {
  const { theme } = useUnistyles();
  const color = theme.colors.primary;
  const { length, width, points } = arrowheadGeometry(SEQUENCE_WIDTH);
  const tipRoom = length * SEQUENCE_WIDTH;
  const caption = theme.typography.caption;

  return (
    <G testID="sequence-layer" pointerEvents="none">
      <Defs>
        <Marker
          id={SEQUENCE_ARROW_ID}
          markerWidth={length}
          markerHeight={width}
          refX="0"
          refY={width / 2}
          orient="auto"
        >
          <Polygon points={points} fill={color} />
        </Marker>
      </Defs>
      {overlay.hops.map((hop) => {
        if (hop.from === draggingId || hop.to === draggingId) return null;
        const from = positions.get(hop.from);
        const to = positions.get(hop.to);
        const d = from && to ? hopPath(from, to, tipRoom) : null;
        if (!d) return null;
        return (
          <Path
            key={`${hop.from}>${hop.to}`}
            testID="sequence-hop"
            d={d}
            stroke={color}
            strokeWidth={SEQUENCE_WIDTH}
            strokeDasharray={SEQUENCE_DASH}
            strokeLinecap="round"
            fill="none"
            markerEnd={`url(#${SEQUENCE_ARROW_ID})`}
          />
        );
      })}
      {[...overlay.numbers].map(([id, numbers]) => {
        const pos = positions.get(id);
        if (!pos || id === draggingId) return null;
        const label = badgeLabel(numbers);
        const badgeWidth = Math.max(
          BADGE_HEIGHT,
          label.length * BADGE_CHAR + BADGE_PAD * 2,
        );
        // Astride the box's top-right corner: clear of the name, of the badges inside (bottom
        // right) and of the timeline's lane names (top left).
        const left = pos.x + NODE_WIDTH / 2 + BADGE_HEIGHT / 3 - badgeWidth;
        const top = pos.y - NODE_HEIGHT / 2 - BADGE_HEIGHT / 2 - 2;
        return (
          <G key={id} testID="sequence-badge">
            <Rect
              x={left}
              y={top}
              width={badgeWidth}
              height={BADGE_HEIGHT}
              rx={BADGE_HEIGHT / 2}
              fill={color}
            />
            <Text
              x={left + badgeWidth / 2}
              y={top + BADGE_HEIGHT / 2 + 4}
              fontFamily={caption.fontFamily}
              fontSize={11}
              fontWeight="700"
              fill={theme.colors.onPrimary}
              textAnchor="middle"
            >
              {label}
            </Text>
          </G>
        );
      })}
    </G>
  );
};

export default SequenceLayer;
