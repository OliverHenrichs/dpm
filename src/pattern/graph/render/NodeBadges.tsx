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
const INSET = 7;
/** Half the play triangle's height, and half its width. */
const PLAY_SIZE = 4;
const DOT_RADIUS = 1.6;
const DOT_GAP = 5;
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

  // Both edges of the badge row, measured the same way: the *outside* of the
  // shapes, not the centre of one and the edge of the other. Mixing the two
  // is what left the video mark further from the right edge than the bottom.
  const edgeRight = x + NODE_WIDTH / 2 - INSET;
  const edgeBottom = y + NODE_HEIGHT / 2 - INSET;
  // The triangle is the tallest thing in the row, so the row's centre line
  // sits half its height above the bottom edge. The dots share that line,
  // which is what makes them read as aligned with it.
  const centerY = edgeBottom - PLAY_SIZE;

  const dots = Math.min(modifierCount, MAX_DOTS);
  // Dots sit to the left of the triangle when both are shown.
  const dotsRight = hasVideo ? edgeRight - PLAY_SIZE * 2 - 3 : edgeRight;

  return (
    <G>
      {hasVideo && (
        <Path
          // Symmetric about `centerY` on purpose. Pinning the lower corner to
          // `edgeBottom` instead would put the shape's bottom at the right
          // inset whatever the centre line was, which is true but says
          // nothing — and makes the alignment untestable.
          d={`M ${edgeRight - PLAY_SIZE * 2} ${centerY - PLAY_SIZE} L ${edgeRight} ${centerY} L ${edgeRight - PLAY_SIZE * 2} ${centerY + PLAY_SIZE} Z`}
          fill={color}
        />
      )}
      {Array.from({ length: dots }, (_, index) => (
        <Circle
          key={index}
          cx={dotsRight - index * DOT_GAP}
          cy={centerY}
          r={DOT_RADIUS}
          fill={color}
        />
      ))}
    </G>
  );
};

export default NodeBadges;
