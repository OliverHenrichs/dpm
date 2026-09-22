import { LayoutPosition } from "@/src/pattern/graph/utils/GraphUtils";
import { NODE_HEIGHT, NODE_WIDTH } from "@/src/pattern/graph/types/Constants";

/** How many viewports wide and tall the canvas starts out. */
const INITIAL_WIDTH_MULTIPLIER = 3;
const INITIAL_HEIGHT_MULTIPLIER = 2;
const CONTENT_PADDING = 300;

/**
 * Bounds on the fitted zoom.
 *
 * The floor matches the canvas's own minimum. The ceiling stops a two-node
 * graph filling the screen with two enormous boxes — past 1:1 the nodes are
 * bigger than they are anywhere else in the app.
 */
const MIN_FITTED_ZOOM = 0.15;
const MAX_FITTED_ZOOM = 1;
/** Breathing room around the content once fitted. */
const FIT_MARGIN = 0.9;

export interface CanvasMetrics {
  svgWidth: number;
  svgHeight: number;
  contentCenterX: number;
  contentCenterY: number;
  initialZoom: number;
}

function contentBounds(positions: Map<number, LayoutPosition>) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const position of positions.values()) {
    minX = Math.min(minX, position.x);
    maxX = Math.max(maxX, position.x);
    minY = Math.min(minY, position.y);
    maxY = Math.max(maxY, position.y);
  }
  return { minX, maxX, minY, maxY };
}

/**
 * How big the canvas must be, and how to frame it, for a given set of
 * positions.
 *
 * Separate from `useGraphLayout` because the positions actually drawn are not
 * always the ones it computed: a manual layout replaces them, and a node
 * dragged beyond the automatic layout's bounds would fall outside the SVG and
 * simply not be drawn.
 */
export function measureCanvas(
  positions: Map<number, LayoutPosition>,
  viewportWidth: number,
  viewportHeight: number,
): CanvasMetrics {
  const initialWidth = viewportWidth * INITIAL_WIDTH_MULTIPLIER;
  const initialHeight = viewportHeight * INITIAL_HEIGHT_MULTIPLIER;

  if (positions.size === 0) {
    return {
      svgWidth: initialWidth,
      svgHeight: initialHeight,
      contentCenterX: initialWidth / 2,
      contentCenterY: initialHeight / 2,
      initialZoom: MAX_FITTED_ZOOM,
    };
  }

  const bounds = contentBounds(positions);
  // Sized to contain the positions as they are. Re-normalising them here
  // would shift every node whenever one was dragged past an edge, which reads
  // as the whole graph jumping.
  const svgWidth = Math.max(
    initialWidth,
    bounds.maxX + NODE_WIDTH / 2 + CONTENT_PADDING / 2,
  );
  const svgHeight = Math.max(
    initialHeight,
    bounds.maxY + NODE_HEIGHT / 2 + CONTENT_PADDING / 2,
  );

  const contentWidth = bounds.maxX - bounds.minX + NODE_WIDTH;
  const contentHeight = bounds.maxY - bounds.minY + NODE_HEIGHT;

  return {
    svgWidth,
    svgHeight,
    contentCenterX: (bounds.minX + bounds.maxX) / 2,
    contentCenterY: (bounds.minY + bounds.maxY) / 2,
    initialZoom: Math.min(
      MAX_FITTED_ZOOM,
      Math.max(
        MIN_FITTED_ZOOM,
        Math.min(viewportWidth / contentWidth, viewportHeight / contentHeight) *
          FIT_MARGIN,
      ),
    ),
  };
}
