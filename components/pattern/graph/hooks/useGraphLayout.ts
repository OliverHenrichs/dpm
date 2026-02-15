import { useMemo } from "react";
import { useWindowDimensions } from "react-native";
import { WCSPattern } from "@/components/pattern/types/WCSPattern";
import { Pattern } from "@/components/pattern/types/PatternList";
import { LayoutPosition } from "../utils/GraphUtils";
import { detectCircularDependencies as detectCircularDepsGeneric } from "../utils/GenericGraphUtils";
import { calculateGraphLayout } from "@/components/pattern/graph/utils/NetworkGraphUtils";

const INITIAL_WIDTH_MULTIPLIER = 3;
const INITIAL_HEIGHT_MULTIPLIER = 2;
const CONTENT_PADDING = 300;

interface GraphLayoutResult {
  positions: Map<number, LayoutPosition>;
  svgWidth: number;
  svgHeight: number;
}

interface ContentBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

type PatternLike = WCSPattern | Pattern;

/**
 * Custom hook for calculating graph layout positions and dimensions.
 * Handles circular dependency detection, position calculations,
 * and SVG canvas sizing based on window dimensions.
 */
export function useGraphLayout<T extends PatternLike>(
  patterns: T[],
): GraphLayoutResult {
  const { width, height } = useWindowDimensions();

  // Use generic circular dependency detection
  detectCircularDepsGeneric(patterns);

  return useMemo(() => {
    const initialWidth = width * INITIAL_WIDTH_MULTIPLIER;
    const initialHeight = height * INITIAL_HEIGHT_MULTIPLIER;
    // Calculate pattern positions
    const positions = calculateGraphLayout(
      patterns as any,
      initialWidth,
      initialHeight,
    );
    if (positions.size === 0) {
      // Empty graph case
      return {
        positions,
        svgWidth: initialWidth,
        svgHeight: initialHeight,
      };
    }
    const bounds = calculateContentBounds(positions);
    const dimensions = calculateSvgDimensions(
      bounds,
      initialWidth,
      initialHeight,
    );
    return {
      positions: normalizePositions(bounds, positions),
      ...dimensions,
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
  // SVG should be large enough to contain all patterns with padding
  const svgWidth = Math.max(initialWidth, contentWidth);
  const svgHeight = Math.max(initialHeight, contentHeight);
  return { svgWidth, svgHeight };
}

function normalizePositions(
  bounds: ContentBounds,
  positions: Map<number, LayoutPosition>,
) {
  // Ensure positions fit within the SVG with proper padding
  // This prevents clipping on the left and top edges
  const normalizedPositions = new Map<number, LayoutPosition>();
  const offsetX = -bounds.minX + CONTENT_PADDING / 2;
  const offsetY = -bounds.minY + CONTENT_PADDING / 2;
  positions.forEach((pos, id) => {
    normalizedPositions.set(id, {
      x: pos.x + offsetX,
      y: pos.y + offsetY,
    });
  });
  return normalizedPositions;
}
