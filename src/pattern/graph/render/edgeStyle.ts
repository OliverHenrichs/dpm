import type { AppTheme } from "@/src/common/theme/tokens";
import { ELIDED_DASH } from "@/src/pattern/graph/types/Constants";

/** How much further back an elided edge sits than a direct one. */
const ELIDED_FADE = 2 / 3;

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
