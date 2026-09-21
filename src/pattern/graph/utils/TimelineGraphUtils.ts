import { IPattern } from "@/src/pattern/types/IPatternList";
import { PatternType } from "@/src/pattern/types/PatternType";
import { LayoutPosition } from "@/src/pattern/graph/utils/GraphUtils";
import {
  HORIZONTAL_SPACING,
  LEFT_MARGIN,
  NODE_HEIGHT,
  START_OFFSET,
  VERTICAL_STACK_SPACING,
} from "@/src/pattern/graph/types/Constants";
import { applyCollisionAvoidance } from "@/src/pattern/graph/utils/CollisionAvoidanceUtils";

export interface SwimlaneInfo {
  y: number;
  height: number;
  typeId?: string; // For dynamic mode
  color?: string; // For dynamic mode
  label?: string; // For dynamic mode
}

export interface SkipLevelEdgeInfo {
  fromId: number;
  toId: number;
  fromDepth: number;
  toDepth: number;
  intermediateNodeIds: number[]; // Nodes that were shifted to make room
  originalIntermediateY: number; // Y coordinate where edge should route (above shifted nodes for horizontal edges)
  firstIntermediateX: number; // X position of first intermediate column (where to finish curving down)
  lastIntermediateX: number; // X position of last intermediate column (where to start curving up)
}
/**
 * Calculate layout positions for timeline view with dynamic pattern types.
 * Uses the same collision avoidance and positioning logic as WCS layout.
 */
export function calculateDynamicTimelineLayout(
  patterns: IPattern[],
  patternTypes: PatternType[],
  width: number,
  baseHeight: number,
  depthMap: Map<number, number>,
): {
  positions: Map<number, LayoutPosition>;
  minHeight: number;
  actualWidth: number;
  swimlanes: SwimlaneInfo[];
  skipLevelEdgeInfos: SkipLevelEdgeInfo[];
  typeColorMap: Map<string, string>;
} {
  const grouped = groupPatternsByTypeId(patterns, patternTypes);
  const maxStackPerType = calculateMaxStackPerTypeDynamic(grouped, depthMap);

  let { swimlaneHeights, swimlaneStarts } = calculateSwimlaneSizesDynamic(
    maxStackPerType,
    patternTypes,
  );

  const positions = positionPatternsByPrerequisitesDynamic(
    grouped,
    depthMap,
    swimlaneStarts,
    patternTypes,
  );

  // Use the same collision avoidance logic
  const { skipLevelEdgeInfos, maxShiftPerType } = applyCollisionAvoidance(
    patterns,
    depthMap,
    positions,
  );

  shiftSwimlaneHeightsDynamic(maxShiftPerType, swimlaneHeights);

  const { cumulativeY, adjustedSwimlaneStarts } =
    recalculateSwimlaneYPositionsDynamic(
      swimlaneStarts,
      patterns,
      positions,
      skipLevelEdgeInfos,
      swimlaneHeights,
      patternTypes,
    );

  const swimlanes = buildSwimlaneInformationDynamic(
    swimlaneHeights,
    adjustedSwimlaneStarts,
    patternTypes,
  );

  const typeColorMap = new Map<string, string>();
  patternTypes.forEach((type) => {
    typeColorMap.set(type.id, type.color);
  });

  return {
    positions,
    minHeight: Math.max(baseHeight, cumulativeY),
    actualWidth: calculateActualWidth(patterns, depthMap, width),
    swimlanes,
    skipLevelEdgeInfos,
    typeColorMap,
  };
}

/**
 * Calculates max depth to determine required width.
 *
 * Measured over the patterns actually being laid out, not over every entry in
 * `depthMap`: under a filter the map is the full graph's, so that a node keeps
 * the column it had unfiltered, and sizing the canvas from it would reserve
 * width for columns nothing is drawn in.
 * */
function calculateActualWidth(
  patterns: IPattern[],
  depthMap: Map<number, number>,
  width: number,
) {
  const maxDepth = Math.max(...patterns.map((p) => depthMap.get(p.id) ?? 0), 0);
  const requiredWidth = LEFT_MARGIN + (maxDepth + 0.5) * HORIZONTAL_SPACING;
  return Math.max(width, requiredWidth);
}

/**
 * Group patterns by their typeId (for dynamic pattern types).
 */
function groupPatternsByTypeId(
  patterns: IPattern[],
  patternTypes: PatternType[],
): Map<string, IPattern[]> {
  const grouped = new Map<string, IPattern[]>();

  // Initialize groups for all pattern types
  patternTypes.forEach((type) => {
    grouped.set(type.id, []);
  });

  // Group patterns by typeId
  patterns.forEach((p) => {
    const group = grouped.get(p.typeId);
    if (group) {
      group.push(p);
    }
  });

  return grouped;
}

function calculateMaxStackPerTypeDynamic(
  grouped: Map<string, IPattern[]>,
  depthMap: Map<number, number>,
): Map<string, number> {
  const maxStackPerType = new Map<string, number>();

  grouped.forEach((typePatterns, typeId) => {
    const depthCounts = new Map<number, number>();

    typePatterns.forEach((pattern) => {
      const depth = depthMap.get(pattern.id) || 0;
      depthCounts.set(depth, (depthCounts.get(depth) || 0) + 1);
    });

    const maxStack = Math.max(...Array.from(depthCounts.values()), 1);
    maxStackPerType.set(typeId, maxStack);
  });

  return maxStackPerType;
}

function calculateSwimlaneSizesDynamic(
  maxStackPerType: Map<string, number>,
  patternTypes: PatternType[],
) {
  const swimlaneHeights = new Map<string, number>();
  const swimlaneStarts = new Map<string, number>();

  let cumulativeY = 0;
  patternTypes.forEach((type) => {
    const maxStack = maxStackPerType.get(type.id) || 1;
    const height =
      START_OFFSET + NODE_HEIGHT + (maxStack - 1) * VERTICAL_STACK_SPACING;

    swimlaneHeights.set(type.id, height);
    swimlaneStarts.set(type.id, cumulativeY + START_OFFSET);
    cumulativeY += height;
  });

  return { swimlaneHeights, swimlaneStarts };
}

function positionPatternsByPrerequisitesDynamic(
  grouped: Map<string, IPattern[]>,
  depthMap: Map<number, number>,
  swimlaneStarts: Map<string, number>,
  patternTypes: PatternType[],
) {
  const positions = new Map<number, LayoutPosition>();
  const depthTypeCounter = new Map<string, number>();

  patternTypes.forEach((type) => {
    const typePatterns = grouped.get(type.id) || [];

    // Sort patterns: first by depth, then by prerequisite IDs to ensure consistent ordering
    const sortedPatterns = [...typePatterns].sort((a, b) => {
      const depthA = depthMap.get(a.id) || 0;
      const depthB = depthMap.get(b.id) || 0;

      // First sort by depth
      if (depthA !== depthB) return depthA - depthB;

      // If same depth, sort by first prerequisite ID (for consistent stacking)
      const prereqA =
        a.prerequisites.length > 0 ? Math.min(...a.prerequisites) : a.id;
      const prereqB =
        b.prerequisites.length > 0 ? Math.min(...b.prerequisites) : b.id;

      if (prereqA !== prereqB) return prereqA - prereqB;

      // Finally, sort by pattern ID for complete consistency
      return a.id - b.id;
    });

    sortedPatterns.forEach((pattern) => {
      const depth = depthMap.get(pattern.id) || 0;
      const x = LEFT_MARGIN + depth * HORIZONTAL_SPACING;

      const key = `${depth}-${type.id}`;
      const stackIndex = depthTypeCounter.get(key) || 0;
      depthTypeCounter.set(key, stackIndex + 1);

      const baseY = (swimlaneStarts.get(type.id) || 0) + START_OFFSET * 0.25;
      const y = baseY + stackIndex * VERTICAL_STACK_SPACING;

      positions.set(pattern.id, { x, y });
    });
  });

  return positions;
}

function shiftSwimlaneHeightsDynamic(
  maxShiftPerType: Map<string, number>,
  swimlaneHeights: Map<string, number>,
) {
  maxShiftPerType.forEach((shift, typeId) => {
    const currentHeight = swimlaneHeights.get(typeId) || 0;
    const newHeight = currentHeight + shift;
    swimlaneHeights.set(typeId, newHeight);
  });
}

function recalculateSwimlaneYPositionsDynamic(
  swimlaneStarts: Map<string, number>,
  patterns: IPattern[],
  positions: Map<number, LayoutPosition>,
  skipLevelEdgeInfos: SkipLevelEdgeInfo[],
  swimlaneHeights: Map<string, number>,
  patternTypes: PatternType[],
) {
  let cumulativeY = 0;
  const adjustedSwimlaneStarts = new Map<string, number>();

  patternTypes.forEach((type) => {
    const originalSwimlaneY = swimlaneStarts.get(type.id) || 0;
    const newSwimlaneY = cumulativeY + START_OFFSET;
    adjustedSwimlaneStarts.set(type.id, newSwimlaneY);

    // Calculate the shift needed for this swimlane
    // This only accounts for swimlane repositioning, NOT collision avoidance
    // (collision avoidance shifts were already applied by applyCollisionAvoidance)
    const swimlaneShift = newSwimlaneY - originalSwimlaneY;

    if (swimlaneShift !== 0) {
      // Shift all node positions in this swimlane
      patterns.forEach((pattern) => {
        if (pattern.typeId === type.id) {
          const pos = positions.get(pattern.id);
          if (pos) {
            positions.set(pattern.id, {
              x: pos.x,
              y: pos.y + swimlaneShift,
            });
          }
        }
      });

      // Shift routing Y in skipLevelEdges for edges in this swimlane
      skipLevelEdgeInfos.forEach((edge) => {
        const fromPattern = patterns.find((p) => p.id === edge.fromId);
        if (
          fromPattern &&
          fromPattern.typeId === type.id &&
          edge.originalIntermediateY !== 0
        ) {
          edge.originalIntermediateY += swimlaneShift;
        }
      });
    }

    const height = swimlaneHeights.get(type.id) || 0;
    cumulativeY += height;
  });

  return { cumulativeY, adjustedSwimlaneStarts };
}

function buildSwimlaneInformationDynamic(
  swimlaneHeights: Map<string, number>,
  swimlaneStarts: Map<string, number>,
  patternTypes: PatternType[],
): SwimlaneInfo[] {
  return patternTypes.map((type) => ({
    // swimlaneStarts contains where nodes start (after START_OFFSET padding)
    // Rectangle should be drawn from the actual top (before padding)
    y: (swimlaneStarts.get(type.id) || 0) - START_OFFSET,
    height: swimlaneHeights.get(type.id) || 0,
    typeId: type.id,
    color: type.color,
    label: type.slug,
  }));
}
