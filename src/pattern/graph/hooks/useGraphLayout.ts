import { useMemo } from "react";
import { useWindowDimensions } from "react-native";
import { LayoutPosition } from "../utils/GraphUtils";
import { calculateGraphLayout } from "@/src/pattern/graph/utils/NetworkGraphUtils";
import { GraphModel } from "@/src/pattern/graph/model/GraphModel";

const INITIAL_WIDTH_MULTIPLIER = 3;
const INITIAL_HEIGHT_MULTIPLIER = 2;
const CONTENT_PADDING = 300;

interface GraphLayoutResult {
  positions: Map<number, LayoutPosition>;
  svgWidth: number;
  svgHeight: number;
  /** Ellipse center in normalized SVG coordinates (post-padding offset). */
  ellipseCenterX: number;
  ellipseCenterY: number;
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
        ellipseCenterX: initialWidth / 2,
        ellipseCenterY: initialHeight / 2,
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

    return {
      positions: normalizePositions(offsetX, offsetY, positions),
      ...dimensions,
      ellipseCenterX: layout.ellipseCenterX + offsetX,
      ellipseCenterY: layout.ellipseCenterY + offsetY,
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
