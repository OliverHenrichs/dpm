import { WCSPattern } from "@/components/pattern/types/WCSPattern";
import { Pattern } from "@/components/pattern/types/PatternList";
import { PatternType } from "@/components/pattern/types/PatternType";
import { WCSPatternType } from "@/components/pattern/types/WCSPatternEnums";
import {
  calculatePrerequisiteDepthMap,
  LayoutPosition,
} from "@/components/pattern/graph/utils/GraphUtils";
import { calculatePrerequisiteDepthMap as calculateDepthMapGeneric } from "@/components/pattern/graph/utils/GenericGraphUtils";
import {
  HORIZONTAL_SPACING,
  LEFT_MARGIN,
  NODE_HEIGHT,
  START_OFFSET,
  VERTICAL_STACK_SPACING,
} from "@/components/pattern/graph/types/Constants";
import { applyCollisionAvoidance } from "@/components/pattern/graph/utils/CollisionAvoidanceUtils";

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
 * Calculate layout positions for utils view.
 * Patterns are arranged in horizontal swimlanes by type (push/pass/whip/tuck),
 * positioned horizontally based on their prerequisite depth,
 * with 70px vertical offsets to stack patterns at the same depth vertically.
 * Returns positions and the minimum required height.
 */
export function calculateTimelineLayout(
  patterns: WCSPattern[],
  width: number,
  baseHeight: number,
): {
  positions: Map<number, LayoutPosition>;
  minHeight: number;
  actualWidth: number;
  swimlanes: Record<WCSPatternType, SwimlaneInfo>;
  skipLevelEdgeInfos: SkipLevelEdgeInfo[];
} {
  const depthMap = calculatePrerequisiteDepthMap(patterns);
  const grouped = groupPatternsByType(patterns);
  const maxStackPerType = calculateMaxStackPerType(grouped, depthMap);
  let { swimlaneHeights, swimlaneStarts } =
    calculateSwimlaneSizes(maxStackPerType);

  const positions = positionPatternsByPrerequisites(
    grouped,
    depthMap,
    swimlaneStarts,
  );

  const { skipLevelEdgeInfos, maxShiftPerType } = applyCollisionAvoidance(
    patterns,
    depthMap,
    positions,
  );

  shiftSwimlaneHeights(maxShiftPerType, swimlaneHeights);

  const { cumulativeY, adjustedSwimlaneStarts } = recalculateSwimlaneYPositions(
    swimlaneStarts,
    patterns,
    positions,
    skipLevelEdgeInfos,
    swimlaneHeights,
  );

  return {
    positions,
    minHeight: Math.max(baseHeight, cumulativeY),
    actualWidth: calculateActualWidth(depthMap, width),
    swimlanes: buildSwimlaneInformation(
      swimlaneHeights,
      adjustedSwimlaneStarts,
    ),
    skipLevelEdgeInfos,
  };
}

/**
 * Calculate layout positions for timeline view with dynamic pattern types.
 * Uses the same collision avoidance and positioning logic as WCS layout.
 */
export function calculateDynamicTimelineLayout(
  patterns: Pattern[],
  patternTypes: PatternType[],
  width: number,
  baseHeight: number,
): {
  positions: Map<number, LayoutPosition>;
  minHeight: number;
  actualWidth: number;
  swimlanes: SwimlaneInfo[];
  skipLevelEdgeInfos: SkipLevelEdgeInfo[];
  typeColorMap: Map<string, string>;
} {
  const depthMap = calculateDepthMapGeneric(patterns);
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
    actualWidth: calculateActualWidth(depthMap, width),
    swimlanes,
    skipLevelEdgeInfos,
    typeColorMap,
  };
}

/**
 * Group patterns by their WCSPatternType.
 */
function groupPatternsByType(
  patterns: WCSPattern[],
): Record<WCSPatternType, WCSPattern[]> {
  const grouped: Record<WCSPatternType, WCSPattern[]> = {
    [WCSPatternType.PUSH]: [],
    [WCSPatternType.PASS]: [],
    [WCSPatternType.WHIP]: [],
    [WCSPatternType.TUCK]: [],
  };

  patterns.forEach((p) => {
    grouped[p.type].push(p);
  });

  return grouped;
}

function buildSwimlaneInformation(
  swimlaneHeights: Map<WCSPatternType, number>,
  swimlaneStarts?: Map<WCSPatternType, number>,
) {
  // If swimlane starts are provided (after shift adjustment), use them
  // Otherwise calculate cumulative positions from heights
  let cumulativeY = 0;
  const typeOrder = Object.values(WCSPatternType) as WCSPatternType[];

  const swimlaneInfo: Record<WCSPatternType, SwimlaneInfo> = {} as Record<
    WCSPatternType,
    SwimlaneInfo
  >;

  typeOrder.forEach((type) => {
    const startY = swimlaneStarts
      ? swimlaneStarts.get(type) || cumulativeY
      : cumulativeY;
    const height = swimlaneHeights.get(type) || 0;

    swimlaneInfo[type] = {
      y: startY,
      height: height,
    };

    cumulativeY = startY + height;
  });

  return swimlaneInfo;
}

function calculateMaxStackPerType(
  grouped: Record<WCSPatternType, WCSPattern[]>,
  depthMap: Map<number, number>,
) {
  const maxStackPerType = new Map<string, number>();

  Object.entries(grouped).forEach(([type, typePatterns]) => {
    const depthCounts = new Map<number, number>();

    typePatterns.forEach((pattern) => {
      const depth = depthMap.get(pattern.id) || 0;
      depthCounts.set(depth, (depthCounts.get(depth) || 0) + 1);
    });

    // Maximum stack height for this type is the max patterns at any depth
    const maxStack = Math.max(...Array.from(depthCounts.values()), 1);
    maxStackPerType.set(type, maxStack);
  });
  return maxStackPerType;
}

/**
 * Calculates max depth to determine required width.
 * */
function calculateActualWidth(depthMap: Map<number, number>, width: number) {
  const maxDepth = Math.max(...Array.from(depthMap.values()), 0);
  const requiredWidth = LEFT_MARGIN + (maxDepth + 0.5) * HORIZONTAL_SPACING;
  return Math.max(width, requiredWidth);
}

/**
 * Dynamically calculates swimlane heights based on content.
 * */
function calculateSwimlaneSizes(maxStackPerType: Map<string, number>) {
  const swimlaneHeights = new Map<WCSPatternType, number>();
  const swimlaneStarts = new Map<WCSPatternType, number>();
  const typeOrder = Object.values(WCSPatternType) as WCSPatternType[];
  const totalHeight = typeOrder.reduce((currentHeight, type) => {
    const maxStack = maxStackPerType.get(type) || 1;
    const height =
      START_OFFSET + NODE_HEIGHT + (maxStack - 1) * VERTICAL_STACK_SPACING;

    swimlaneHeights.set(type, height);
    swimlaneStarts.set(type, currentHeight + START_OFFSET);
    return currentHeight + height;
  }, 0);
  return { swimlaneHeights, swimlaneStarts, totalHeight };
}

function positionPatternsByPrerequisites(
  grouped: Record<WCSPatternType, WCSPattern[]>,
  depthMap: Map<number, number>,
  swimlaneStarts: Map<WCSPatternType, number>,
) {
  const positions = new Map<number, LayoutPosition>();
  const depthTypeCounter = new Map<string, number>();

  // PASS 1: Position all nodes initially without collision avoidance
  Object.entries(grouped).forEach(([type, typePatterns]) => {
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
      const baseY = swimlaneStarts.get(type as WCSPatternType) || 0;

      // Position horizontally based on depth
      const x = LEFT_MARGIN + depth * HORIZONTAL_SPACING;

      // Track how many patterns at this depth+type for vertical stacking
      const key = `${depth}-${type}`;
      const stackIndex = depthTypeCounter.get(key) || 0;
      depthTypeCounter.set(key, stackIndex + 1);

      // Calculate initial vertical position
      const y = baseY + stackIndex * VERTICAL_STACK_SPACING;

      positions.set(pattern.id, { x, y });
    });
  });

  return positions;
}

function shiftSwimlaneHeights(
  maxShiftPerType: Map<string, number>,
  swimlaneHeights: Map<WCSPatternType, number>,
) {
  maxShiftPerType.forEach((shift, type) => {
    const patternType = type as WCSPatternType;
    const currentHeight = swimlaneHeights.get(patternType) || 0;
    swimlaneHeights.set(patternType, currentHeight + shift);
  });
}

function recalculateSwimlaneYPositions(
  swimlaneStarts: Map<WCSPatternType, number>,
  patterns: WCSPattern[],
  positions: Map<number, LayoutPosition>,
  skipLevelEdgeInfos: SkipLevelEdgeInfo[],
  swimlaneHeights: Map<WCSPatternType, number>,
) {
  // Recalculate swimlane Y positions to account for expanded heights
  // Each swimlane's Y is the cumulative height of all swimlanes above it
  // AND shift all positional data (nodes, edges) to match new swimlane positions
  const typeOrder = Object.values(WCSPatternType) as WCSPatternType[];
  let cumulativeY = 0;
  const adjustedSwimlaneStarts = new Map<WCSPatternType, number>();

  typeOrder.forEach((type) => {
    const originalSwimlaneY = swimlaneStarts.get(type) || 0;
    const newSwimlaneY = cumulativeY;
    adjustedSwimlaneStarts.set(type, newSwimlaneY);

    // Calculate the shift needed for this swimlane
    const swimlaneShift = newSwimlaneY - originalSwimlaneY + NODE_HEIGHT - 10;

    if (swimlaneShift !== 0) {
      // Shift all node positions in this swimlane
      patterns.forEach((pattern) => {
        if (pattern.type === type) {
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
          fromPattern.type === type &&
          edge.originalIntermediateY !== 0
        ) {
          edge.originalIntermediateY += swimlaneShift;
        }
      });
    }

    const height = swimlaneHeights.get(type) || 0;
    cumulativeY += height;
  });
  return { cumulativeY, adjustedSwimlaneStarts };
}

// ============================================================================
// Dynamic Pattern Type Functions
// ============================================================================

/**
 * Group patterns by their typeId (for dynamic pattern types).
 */
function groupPatternsByTypeId(
  patterns: Pattern[],
  patternTypes: PatternType[],
): Map<string, Pattern[]> {
  const grouped = new Map<string, Pattern[]>();

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
  grouped: Map<string, Pattern[]>,
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
  grouped: Map<string, Pattern[]>,
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

      const baseY = swimlaneStarts.get(type.id) || 0;
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
    swimlaneHeights.set(typeId, currentHeight + shift);
  });
}

function recalculateSwimlaneYPositionsDynamic(
  swimlaneStarts: Map<string, number>,
  patterns: Pattern[],
  positions: Map<number, LayoutPosition>,
  skipLevelEdgeInfos: SkipLevelEdgeInfo[],
  swimlaneHeights: Map<string, number>,
  patternTypes: PatternType[],
) {
  let cumulativeY = 0;
  const adjustedSwimlaneStarts = new Map<string, number>();

  patternTypes.forEach((type) => {
    const originalSwimlaneY = swimlaneStarts.get(type.id) || 0;
    const newSwimlaneY = cumulativeY;
    adjustedSwimlaneStarts.set(type.id, newSwimlaneY);

    // Calculate the shift needed for this swimlane
    const swimlaneShift = newSwimlaneY - originalSwimlaneY + NODE_HEIGHT - 10;

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
    y: swimlaneStarts.get(type.id) || 0,
    height: swimlaneHeights.get(type.id) || 0,
    typeId: type.id,
    color: type.color,
    label: type.slug,
  }));
}
