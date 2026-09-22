import { LayoutPosition } from "@/src/pattern/graph/utils/GraphUtils";
import { NODE_HEIGHT, NODE_WIDTH } from "@/src/pattern/graph/types/Constants";

export interface Viewport {
  width: number;
  height: number;
}

export interface CanvasTransformValues {
  scale: number;
  translateX: number;
  translateY: number;
}

export interface ContentSize {
  width: number;
  height: number;
}

/**
 * Where a touch lands in the graph's own coordinates.
 *
 * The canvas centres the content in the viewport, then applies
 * `[translate, scale]` in that order. Inverting it: take the touch relative to
 * the viewport centre, undo the translation, undo the zoom, then re-centre on
 * the content.
 *
 * A worklet: this runs inside a gesture handler on the UI thread.
 */
export function screenToContent(
  screenX: number,
  screenY: number,
  viewport: Viewport,
  transform: CanvasTransformValues,
  content: ContentSize,
): LayoutPosition {
  "worklet";
  const scale = transform.scale === 0 ? 1 : transform.scale;
  return {
    x:
      (screenX - viewport.width / 2 - transform.translateX) / scale +
      content.width / 2,
    y:
      (screenY - viewport.height / 2 - transform.translateY) / scale +
      content.height / 2,
  };
}

/**
 * A screen-space drag distance, in graph coordinates.
 *
 * Dividing by the zoom is what makes a dragged node track the finger. Without
 * it the node lags the finger above 1:1 and outruns it below — and because the
 * zoom is read live rather than captured at gesture start, that stays true if
 * the view is zoomed mid-drag.
 */
export function screenDeltaToContent(delta: number, scale: number): number {
  "worklet";
  return scale === 0 ? delta : delta / scale;
}

/**
 * The node under a point in graph coordinates, or null.
 *
 * Later entries win, matching paint order: nodes drawn on top of each other
 * are picked topmost-first, which is the one the user can see.
 */
export function findNodeAt(
  point: LayoutPosition,
  positions: Map<number, LayoutPosition>,
): number | null {
  "worklet";
  let found: number | null = null;
  for (const [id, position] of positions) {
    if (
      Math.abs(point.x - position.x) <= NODE_WIDTH / 2 &&
      Math.abs(point.y - position.y) <= NODE_HEIGHT / 2
    ) {
      found = id;
    }
  }
  return found;
}
