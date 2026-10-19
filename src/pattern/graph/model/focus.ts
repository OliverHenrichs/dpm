import { LayoutPosition } from "@/src/pattern/graph/utils/GraphUtils";
import { NODE_HEIGHT, NODE_WIDTH } from "@/src/pattern/graph/types/Constants";
import {
  CanvasTransformValues,
  ContentSize,
  screenToContent,
  Viewport,
} from "@/src/pattern/graph/model/graphCoordinates";

/**
 * Radius of the focus mark in the middle of the network view, in screen
 * pixels. A node "touches the centre" when its box comes this close to it, so
 * the reach stays the same on screen at every zoom.
 */
export const FOCUS_RADIUS = 28;

/**
 * Distance from a point to a node's box, in graph units; 0 inside it.
 *
 * A worklet: the focus is tracked on the UI thread as the canvas moves.
 */
export function distanceToNode(
  point: LayoutPosition,
  node: LayoutPosition,
): number {
  "worklet";
  const dx = Math.max(0, Math.abs(point.x - node.x) - NODE_WIDTH / 2);
  const dy = Math.max(0, Math.abs(point.y - node.y) - NODE_HEIGHT / 2);
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * The node in focus: one whose box touches a circle of `radius` (graph units)
 * around `point`, or null.
 *
 * The current one keeps the focus for as long as it still touches. Two boxes
 * can both touch the circle, and handing the focus to whichever is a pixel
 * nearer would flicker between them on every frame of a slow pan. Otherwise
 * the nearest wins; on a tie the later entry, which is drawn on top.
 */
export function pickFocus(
  point: LayoutPosition,
  radius: number,
  positions: Map<number, LayoutPosition>,
  current: number | null,
): number | null {
  "worklet";
  if (current !== null) {
    const kept = positions.get(current);
    if (kept && distanceToNode(point, kept) <= radius) return current;
  }
  let found: number | null = null;
  let best = Infinity;
  for (const [id, position] of positions) {
    const distance = distanceToNode(point, position);
    if (distance <= radius && distance <= best) {
      best = distance;
      found = id;
    }
  }
  return found;
}

/**
 * The canvas translation that puts a graph point in the middle of the
 * viewport. The inverse of `screenToContent` at the viewport's centre.
 */
export function translationToCentre(
  position: LayoutPosition,
  scale: number,
  content: ContentSize,
): { translateX: number; translateY: number } {
  "worklet";
  return {
    translateX: (content.width / 2 - position.x) * scale,
    translateY: (content.height / 2 - position.y) * scale,
  };
}

/**
 * The pattern under the focus mark, for a canvas transformed by `transform`
 * in a viewport of `viewport`: whatever touches `FOCUS_RADIUS` screen pixels
 * around the viewport's centre, by `pickFocus`'s rules.
 */
export function focusAtCentre(
  viewport: Viewport,
  transform: CanvasTransformValues,
  content: ContentSize,
  positions: Map<number, LayoutPosition>,
  current: number | null,
): number | null {
  "worklet";
  const centre = screenToContent(
    viewport.width / 2,
    viewport.height / 2,
    viewport,
    transform,
    content,
  );
  const scale = transform.scale === 0 ? 1 : transform.scale;
  return pickFocus(centre, FOCUS_RADIUS / scale, positions, current);
}
