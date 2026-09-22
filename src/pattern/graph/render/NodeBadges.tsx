import React from "react";
import { Circle, G, Path } from "react-native-svg";
import { NodeBadges as Badges } from "@/src/pattern/graph/model/nodeBadges";
import { NODE_HEIGHT, NODE_WIDTH } from "@/src/pattern/graph/types/Constants";

/**
 * Inset from the node's bottom-right corner. Everything here stays inside the
 * existing 100×60 box on purpose: `NODE_WIDTH`/`NODE_HEIGHT` feed the
 * timeline's swimlane sizing and its collision-avoidance pass, so node size is
 * not a free variable — growing it would move the timeline layout everywhere.
 */
const INSET = 3;
/** Half the play triangle's height, and half its width. */
const PLAY_SIZE = 5.5;
const DOT_RADIUS = 2;
/** Between dot centres. */
const DOT_GAP = 5.5;
/** Between the last dot and the triangle, when both are drawn. */
const DOT_TO_PLAY_GAP = 3;
/** Beyond this, more dots would not fit or read; the details view has the number. */
const MAX_DOTS = 3;

interface NodeBadgesProps {
  badges: Badges;
  /** Node centre. */
  x: number;
  y: number;
  /** The type colour, which is already the node's border. */
  color: string;
}

/**
 * Small marks in the corner of a node: video, and attached modifiers.
 *
 * Drawn as shapes rather than glyphs from a font — a triangle and dots render
 * identically everywhere, where an emoji or a box-drawing character depends on
 * what the device has installed.
 *
 * Coloured with the node's own type colour rather than a text token. The
 * node's fill opacity already varies by level (0.3 / 0.5 / 0.7), so a
 * secondary-text grey would wash out on an advanced pattern.
 */
const NodeBadges: React.FC<NodeBadgesProps> = ({ badges, x, y, color }) => {
  const { hasVideo, modifierCount } = badges;
  if (!hasVideo && modifierCount === 0) return null;

  // Where the badges stop. Every shape below is positioned by its *bounding
  // box*, never by a centre line on one axis and an edge on the other —
  // mixing the two is what left each mark lopsided in its corner.
  const edgeRight = x + NODE_WIDTH / 2 - INSET;
  const edgeBottom = y + NODE_HEIGHT / 2 - INSET;

  // The triangle takes the corner: its box sits hard against both edges.
  const playCenterY = edgeBottom - PLAY_SIZE;
  const playLeft = edgeRight - PLAY_SIZE * 2;

  const dots = Math.min(modifierCount, MAX_DOTS);
  // Alongside the triangle, the dots share its centre line so the two read as
  // one row. Alone, they take the corner themselves — otherwise they would
  // hang the triangle's height above the bottom edge with nothing beneath.
  const dotsCenterY = hasVideo ? playCenterY : edgeBottom - DOT_RADIUS;
  const dotsRightCenter = hasVideo
    ? playLeft - DOT_TO_PLAY_GAP - DOT_RADIUS
    : edgeRight - DOT_RADIUS;

  return (
    <G>
      {hasVideo && (
        <Path
          // Symmetric about `centerY` on purpose. Pinning the lower corner to
          // `edgeBottom` instead would put the shape's bottom at the right
          // inset whatever the centre line was, which is true but says
          // nothing — and makes the alignment untestable.
          d={`M ${playLeft} ${playCenterY - PLAY_SIZE} L ${edgeRight} ${playCenterY} L ${playLeft} ${playCenterY + PLAY_SIZE} Z`}
          fill={color}
        />
      )}
      {Array.from({ length: dots }, (_, index) => (
        <Circle
          key={index}
          cx={dotsRightCenter - index * DOT_GAP}
          cy={dotsCenterY}
          r={DOT_RADIUS}
          fill={color}
        />
      ))}
    </G>
  );
};

export default NodeBadges;
