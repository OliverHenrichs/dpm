import { useMemo } from "react";
import { useWindowDimensions } from "react-native";
import { LayoutPosition } from "../utils/GraphUtils";
import { calculateGraphLayout } from "@/src/pattern/graph/utils/NetworkGraphUtils";
import { GraphModel } from "@/src/pattern/graph/model/GraphModel";
import { NODE_HEIGHT, NODE_WIDTH } from "@/src/pattern/graph/types/Constants";

const INITIAL_WIDTH_MULTIPLIER = 3;
const INITIAL_HEIGHT_MULTIPLIER = 2;
const CONTENT_PADDING = 300;

/**
 * Bounds on the fitted zoom.
 *
 * The floor matches the zoomable view's own `minZoom`. The ceiling stops a
 * two-node graph filling the screen with two enormous boxes — past 1:1 the
 * nodes are bigger than they are anywhere else in the app.
 */
const MIN_FITTED_ZOOM = 0.15;
const MAX_FITTED_ZOOM = 1;
/** Breathing room around the content once fitted. */
const FIT_MARGIN = 0.9;

interface GraphLayoutResult {
  positions: Map<number, LayoutPosition>;
  svgWidth: number;
  svgHeight: number;
  /**
   * Centre of what is actually drawn, in normalized SVG coordinates.
   *
   * The bounding box's centre rather than the ellipse's: they coincide for a
   * full radial layout, but a filtered graph can sit well off to one side of
   * the ellipse the unfiltered layout would have used.
   */
  contentCenterX: number;
  contentCenterY: number;
  /**
   * Zoom that frames the drawn content in the viewport.
   *
   * Fixed at 0.35 before filtering existed, which is about right for a whole
   * list and leaves the user staring at empty canvas once a filter narrows it
   * to a handful of nodes.
   */
  initialZoom: number;
}

interface ContentBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/**
 * Custom hook for calculating graph layout positions and dimensions.
 * Handles circular dependency detection, position calculations,
 * and SVG canvas sizing based on window dimensions.
 */
export function useGraphLayout(model: GraphModel): GraphLayoutResult {
  const { width, height } = useWindowDimensions();
  const patterns = model.patterns;

  // Cycle detection lives in the model now. It used to run here on *every*
  // render — outside this memo — and the detector it called enumerated every
  // distinct path through the graph just to emit a console warning.
  return useMemo(() => {
    const initialWidth = width * INITIAL_WIDTH_MULTIPLIER;
    const initialHeight = height * INITIAL_HEIGHT_MULTIPLIER;

    const layout = calculateGraphLayout(patterns, initialWidth, initialHeight);
    const { positions } = layout;

    if (positions.size === 0) {
      return {
        positions,
        svgWidth: initialWidth,
        svgHeight: initialHeight,
        contentCenterX: initialWidth / 2,
        contentCenterY: initialHeight / 2,
        initialZoom: MAX_FITTED_ZOOM,
      };
    }

    const bounds = calculateContentBounds(positions);
    const dimensions = calculateSvgDimensions(
      bounds,
      initialWidth,
      initialHeight,
    );

    // The normalization offset shifts all positions so minX/minY land at CONTENT_PADDING/2.
    const offsetX = -bounds.minX + CONTENT_PADDING / 2;
    const offsetY = -bounds.minY + CONTENT_PADDING / 2;

    // Post-normalization the content starts at CONTENT_PADDING / 2, so its
    // extent is all that is left to measure.
    const contentWidth = bounds.maxX - bounds.minX + NODE_WIDTH;
    const contentHeight = bounds.maxY - bounds.minY + NODE_HEIGHT;

    return {
      positions: normalizePositions(offsetX, offsetY, positions),
      ...dimensions,
      contentCenterX: CONTENT_PADDING / 2 + (bounds.maxX - bounds.minX) / 2,
      contentCenterY: CONTENT_PADDING / 2 + (bounds.maxY - bounds.minY) / 2,
      initialZoom: Math.min(
        MAX_FITTED_ZOOM,
        Math.max(
          MIN_FITTED_ZOOM,
          Math.min(width / contentWidth, height / contentHeight) * FIT_MARGIN,
        ),
      ),
    };
  }, [patterns, width, height]);
}

/**
 * Calculate the bounding box containing all pattern positions
 */
function calculateContentBounds(
  positions: Map<number, LayoutPosition>,
): ContentBounds {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  positions.forEach((pos) => {
    minX = Math.min(minX, pos.x);
    maxX = Math.max(maxX, pos.x);
    minY = Math.min(minY, pos.y);
    maxY = Math.max(maxY, pos.y);
  });
  return { minX, maxX, minY, maxY };
}

/**
 * Calculate SVG dimensions based on content bounds and initial dimensions
 */
function calculateSvgDimensions(
  bounds: ContentBounds,
  initialWidth: number,
  initialHeight: number,
): { svgWidth: number; svgHeight: number } {
  const contentWidth = bounds.maxX - bounds.minX + CONTENT_PADDING;
  const contentHeight = bounds.maxY - bounds.minY + CONTENT_PADDING;
  const svgWidth = Math.max(initialWidth, contentWidth);
  const svgHeight = Math.max(initialHeight, contentHeight);
  return { svgWidth, svgHeight };
}

function normalizePositions(
  offsetX: number,
  offsetY: number,
  positions: Map<number, LayoutPosition>,
) {
  const normalizedPositions = new Map<number, LayoutPosition>();
  positions.forEach((pos, id) => {
    normalizedPositions.set(id, {
      x: pos.x + offsetX,
      y: pos.y + offsetY,
    });
  });
  return normalizedPositions;
}
