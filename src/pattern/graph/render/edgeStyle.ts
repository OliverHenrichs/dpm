import type { AppTheme } from "@/src/common/theme/tokens";
import { ARROW_LENGTH, ELIDED_DASH } from "@/src/pattern/graph/types/Constants";

/** How much further back an elided edge sits than a direct one. */
const ELIDED_FADE = 2 / 3;

/** An arrowhead's width as a share of its length. */
const ARROW_ASPECT = 0.6;

/** The edge colour in the app style: After Hours' accent, Clipboard's muted rule. */
export function edgeColor(theme: AppTheme): string {
  return theme.colors[theme.graph.edgeColor];
}

/**
 * Stroke props for an edge in either view, in the app style (`theme.graph`).
 *
 * In its own module rather than in `GraphPrimitives` because `DraggedEdge`
 * needs it too, and `GraphPrimitives` imports `DraggedEdge`.
 */
export function edgeStroke(theme: AppTheme, elided: boolean) {
  const { edgeWidth, edgeOpacity } = theme.graph;
  return {
    stroke: edgeColor(theme),
    strokeWidth: edgeWidth,
    strokeDasharray: elided ? ELIDED_DASH : undefined,
    opacity: elided ? edgeOpacity * ELIDED_FADE : edgeOpacity,
  };
}

/**
 * The arrowhead's marker props. A marker's units are multiples of the stroke
 * width, so its length is worked out from the style's edge width: the tip has
 * to cover exactly the `ARROW_LENGTH` an edge stops short of its box.
 */
export function arrowheadGeometry(edgeWidth: number) {
  const length = ARROW_LENGTH / edgeWidth;
  const width = length * ARROW_ASPECT;
  return {
    length,
    width,
    points: `0 0, ${length} ${width / 2}, 0 ${width}`,
  };
}
