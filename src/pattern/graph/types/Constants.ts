// Constants for node dimensions and spacing
export const START_OFFSET = 40;
export const VERTICAL_STACK_SPACING = 70; // Node height + 10px padding
export const HORIZONTAL_SPACING = 170; // Space between depth levels
export const LEFT_MARGIN = 120;
export const NODE_WIDTH = 100;
export const NODE_HEIGHT = 60;
// Space for swimlane labels
export const MIN_PATTERN_HEIGHT = VERTICAL_STACK_SPACING * 2;
export const MIN_PATTERNS_VISIBLE = 2;
// Edge spacing - multiple edges can fit in the vertical space of one node
export const EDGE_VERTICAL_SPACING = 15; // Vertical space required per edge

/**
 * How far from the origin a node may be placed, in either axis.
 *
 * A safeguard against a degenerate layout producing coordinates large enough
 * to make the SVG canvas unusable. Shared with the stored manual layout, which
 * must be clamped to the same box — a position outside it would be
 * unreachable, and there would be no way to drag the node back.
 */
export const MAX_GRAPH_COORDINATE = 4000;

/** Distance the radial layout puts between a node and its prerequisite. */
export const DEPTH_SPACING = 220;
