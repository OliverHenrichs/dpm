import { LayoutPosition } from "@/components/pattern/graph/utils/GraphUtils";
import { SkipLevelEdgeInfo } from "@/components/pattern/graph/utils/TimelineGraphUtils";
import {
  EDGE_VERTICAL_SPACING,
  HORIZONTAL_SPACING,
  LEFT_MARGIN,
  NODE_HEIGHT,
} from "@/components/pattern/graph/types/Constants";
import { Pattern } from "@/components/pattern/types/PatternList";

interface IEdgeRoutingInfo {
  nodeIds: number[];
  routingY: number;
  firstIntermediateX: number;
  lastIntermediateX: number;
}

interface IEdge {
  fromId: number;
  toId: number;
  fromDepth: number;
  toDepth: number;
  fromY: number;
  toY: number;
}

interface IAllocatedSlot {
  slotIndex: number;
  xStart: number;
  xEnd: number;
  edgeKey: string;
}

/**
 * Apply collision avoidance by detecting skip-level edges and shifting intermediate nodes.
 * Uses dynamic slot allocation to allow multiple edges to share cleared space efficiently.
 * Returns information about skip-level edges, which nodes were shifted, and max shifts per type.
 */
export function applyCollisionAvoidance(
  patterns: Pattern[],
  depthMap: Map<number, number>,
  positions: Map<number, LayoutPosition>,
): {
  skipLevelEdgeInfos: SkipLevelEdgeInfo[];
  maxShiftPerType: Map<string, number>;
} {
  const patternMap = new Map<number, Pattern>();
  patterns.forEach((p) => patternMap.set(p.id, p));

  // Store original positions before any shifting
  const originalPositions = new Map<number, number>();
  positions.forEach((pos, id) => {
    originalPositions.set(id, pos.y);
  });

  const skipLevelEdges = findSkipLevelEdges(
    patterns,
    depthMap,
    positions,
    patternMap,
  );

  // Sort edges by depth span (longer first) to prioritize routing for more complex edges
  skipLevelEdges.sort((a, b) => {
    const spanA = a.toDepth - a.fromDepth;
    const spanB = b.toDepth - b.fromDepth;
    return spanB - spanA; // Descending: longer edges first
  });

  // Track slot allocations per swimlane to enable slot reuse
  const swimlaneSlotAllocations = new Map<string, IAllocatedSlot[]>(); // typeId -> allocated slots

  // For each skip-level edge, find intermediate nodes that would be crossed
  const nodeToMaxSlot = new Map<number, number>(); // patternId -> max slot index of edges crossing it
  const edgeToIntermediateNodes = new Map<string, IEdgeRoutingInfo>(); // "fromId-toId" -> {intermediateNodeIds, routingY, column positions}
  const nodeToPlannedShift = new Map<number, number>(); // patternId -> cumulative shift planned by previous edges

  skipLevelEdges.forEach((edge) => {
    const source = patternMap.get(edge.fromId);
    const edgeType = getType(source);
    if (!edgeType) return;

    const intermediateNodeIds = getIntersectingIntermediateNodes(
      edge,
      patterns,
      edgeType,
      depthMap,
      positions,
    );

    // Calculate routing Y based on the cleared space created by shifting nodes
    if (intermediateNodeIds.length > 0) {
      const slotIndex = allocateDynamicSlot(
        edge,
        edgeType,
        swimlaneSlotAllocations,
        nodeToMaxSlot,
        intermediateNodeIds,
      );
      swimlaneSlotAllocations.forEach((slots) => {
        slots.forEach((slot) => {
          console.log(
            `[CollisionAvoidance] Slot ${slot.slotIndex} allocated for edge ${slot.edgeKey} (x: ${slot.xStart.toFixed(0)}-${slot.xEnd.toFixed(0)})`,
          );
          const splitKey = slot.edgeKey.split("-");
          console.log(
            `[CollisionAvoidance]   -> from: ${patterns.find((p) => p.id === Number(splitKey[0]))?.name}, to: ${patterns.find((p) => p.id === Number(splitKey[1]))?.name}`,
          );
        });
      });

      calculateEdgeYRouting(
        edge,
        intermediateNodeIds,
        originalPositions,
        nodeToPlannedShift,
        slotIndex,
        edgeToIntermediateNodes,
        patterns,
      );

      // Update planned shifts for nodes that will be affected by this edge
      const shiftAmount = (slotIndex + 1) * EDGE_VERTICAL_SPACING;

      intermediateNodeIds.forEach((nodeId) => {
        const currentPlannedShift = nodeToPlannedShift.get(nodeId) || 0;
        nodeToPlannedShift.set(
          nodeId,
          Math.max(currentPlannedShift, shiftAmount),
        );
      });
    }
  });

  // Calculate the maximum slot index used in each swimlane
  // This determines how much space needs to be cleared
  const maxSlotPerType = calculateMaxSlotPerType(swimlaneSlotAllocations);
  console.log("[CollisionAvoidance] Max slot per type:", maxSlotPerType);

  const nodesToShift = convertToShiftNodes(nodeToMaxSlot);
  console.log("[CollisionAvoidance] Nodes to shift:", nodesToShift);
  const nodesByDepthType = createNodesByDepthType(
    patterns,
    depthMap,
    positions,
  );
  console.log("[CollisionAvoidance] Nodes by depth type:", nodesByDepthType);
  const maxShiftPerType = calculateCumulativeShifts(
    nodesByDepthType,
    nodesToShift,
    positions,
    maxSlotPerType, // Pass slot info to ensure swimlane heights account for all slots
  );
  console.log("[CollisionAvoidance] Max shift per type:", maxShiftPerType);
  const skipLevelEdgeInfos = buildSkipLevelEdgeInfos(
    skipLevelEdges,
    edgeToIntermediateNodes,
  );
  return { skipLevelEdgeInfos, maxShiftPerType };
}

function getType(source?: Pattern): string | undefined {
  if (!source) return undefined;
  return source.typeId;
}

function findSkipLevelEdges(
  patterns: Pattern[],
  depthMap: Map<number, number>,
  positions: Map<number, LayoutPosition>,
  patternMap: Map<number, Pattern>,
) {
  // Find all skip-level edges (edges that span more than 1 depth level)
  const skipLevelEdges: {
    fromId: number;
    toId: number;
    fromDepth: number;
    toDepth: number;
    fromY: number;
    toY: number;
  }[] = [];

  patterns.forEach((pattern) => {
    const toDepth = depthMap.get(pattern.id) || 0;
    const toPos = positions.get(pattern.id);
    if (!toPos) return;

    pattern.prerequisites.forEach((prereqId) => {
      const fromDepth = depthMap.get(prereqId) || 0;
      const depthSpan = toDepth - fromDepth;

      // Only consider skip-level edges (spanning more than 1 depth level)
      if (depthSpan <= 1) return;

      const fromPos = positions.get(prereqId);
      if (!fromPos) return;

      // Check if they're in the same swimlane (same type)
      const prereqPattern = patternMap.get(prereqId);
      if (!prereqPattern || prereqPattern.typeId !== pattern.typeId) return;

      skipLevelEdges.push({
        fromId: prereqId,
        toId: pattern.id,
        fromDepth,
        toDepth,
        fromY: fromPos.y,
        toY: toPos.y,
      });
    });
  });
  return skipLevelEdges;
}

/**
 * Dynamically allocate the lowest available slot for an edge.
 * Slots can be reused if edges don't overlap horizontally (X-axis).
 */
function allocateDynamicSlot(
  edge: IEdge,
  edgeType: string,
  swimlaneSlotAllocations: Map<string, IAllocatedSlot[]>,
  nodeToMaxSlot: Map<number, number>,
  intermediateNodeIds: number[],
): number {
  const edgeKey = `${edge.fromId}-${edge.toId}`;
  const edgeXStart = LEFT_MARGIN + edge.fromDepth * HORIZONTAL_SPACING;
  const edgeXEnd = LEFT_MARGIN + edge.toDepth * HORIZONTAL_SPACING;

  // Get existing slot allocations for this swimlane
  if (!swimlaneSlotAllocations.has(edgeType)) {
    swimlaneSlotAllocations.set(edgeType, []);
  }
  const allocatedSlots = swimlaneSlotAllocations.get(edgeType)!;

  // Find the lowest available slot that doesn't conflict with existing edges
  let slotIndex = 0;
  let slotAvailable = false;

  while (!slotAvailable) {
    // Check if this slot is available (no horizontal overlap with existing edges in this slot)
    const conflictingEdges = allocatedSlots.filter(
      (allocated) =>
        allocated.slotIndex === slotIndex &&
        !(edgeXEnd <= allocated.xStart || edgeXStart >= allocated.xEnd),
    );

    if (conflictingEdges.length === 0) {
      // Slot is available!
      slotAvailable = true;
    } else {
      // Try next slot
      slotIndex++;
    }
  }

  // Allocate this slot for this edge
  allocatedSlots.push({
    slotIndex,
    xStart: edgeXStart,
    xEnd: edgeXEnd,
    edgeKey,
  });

  // Update node-to-slot mapping
  intermediateNodeIds.forEach((nodeId) => {
    const currentMaxSlot = nodeToMaxSlot.get(nodeId) || -1;
    nodeToMaxSlot.set(nodeId, Math.max(currentMaxSlot, slotIndex));
  });

  console.log(
    `[CollisionAvoidance] Edge ${edgeKey}: allocated slot ${slotIndex}`,
    `(x: ${edgeXStart.toFixed(0)}-${edgeXEnd.toFixed(0)})`,
  );

  return slotIndex;
}

/**
 * Calculate the maximum slot index used in each swimlane.
 * This determines the total cleared space needed for routing.
 */
function calculateMaxSlotPerType(
  swimlaneSlotAllocations: Map<string, IAllocatedSlot[]>,
): Map<string, number> {
  const maxSlotPerType = new Map<string, number>();

  swimlaneSlotAllocations.forEach((allocations, typeId) => {
    let maxSlot = -1;
    allocations.forEach((allocation) => {
      maxSlot = Math.max(maxSlot, allocation.slotIndex);
    });
    if (maxSlot >= 0) {
      maxSlotPerType.set(typeId, maxSlot);
    }
  });

  return maxSlotPerType;
}

function getIntersectingIntermediateNodes(
  edge: IEdge,
  patterns: Pattern[],
  edgeType: string,
  depthMap: Map<number, number>,
  positions: Map<number, LayoutPosition>,
) {
  const result: number[] = [];

  // Find all nodes at intermediate depths in the same swimlane
  patterns.forEach((intermediatePattern) => {
    if (getType(intermediatePattern) !== edgeType) return;

    const intermediateDepth = depthMap.get(intermediatePattern.id) || 0;

    // Check if this pattern is at an intermediate depth
    if (
      intermediateDepth > edge.fromDepth &&
      intermediateDepth < edge.toDepth
    ) {
      const intermediatePos = positions.get(intermediatePattern.id);
      if (!intermediatePos) return;

      // Check if the edge would pass through this node's vertical region
      const minEdgeY = Math.min(edge.fromY, edge.toY);
      const maxEdgeY = Math.max(edge.fromY, edge.toY);
      const nodeTop = intermediatePos.y - NODE_HEIGHT / 2;
      const nodeBottom = intermediatePos.y + NODE_HEIGHT / 2;

      // If there's vertical overlap, this edge crosses our node
      if (maxEdgeY >= nodeTop && minEdgeY <= nodeBottom) {
        result.push(intermediatePattern.id);
      }
    }
  });
  return result;
}

function calculateEdgeYRouting(
  edge: IEdge,
  intermediateNodeIds: number[],
  originalPositions: Map<number, number>,
  nodeToPlannedShift: Map<number, number>,
  slotIndex: number,
  edgeToIntermediateNodes: Map<string, IEdgeRoutingInfo>,
  patterns: Pattern[],
) {
  const edgeKey = `${edge.fromId}-${edge.toId}`;

  console.log(
    `[CollisionAvoidance] intermediate node names for edge ${edgeKey}:`,
    intermediateNodeIds.map((id) => patterns.find((p) => p.id === id)?.name),
  );
  // Find the topmost intermediate node (considering planned shifts)
  // We need to consider both original position AND planned shifts
  // because previous edges may have already claimed space
  const topmostNodeId = intermediateNodeIds.reduce((topId, nodeId) => {
    const topOrigY = originalPositions.get(topId) || Infinity;
    const nodeOrigY = originalPositions.get(nodeId) || Infinity;
    // Account for planned shifts to find the actual topmost node after shifts
    const topPlannedShift = nodeToPlannedShift.get(topId) || 0;
    const nodePlannedShift = nodeToPlannedShift.get(nodeId) || 0;
    const topFinalY = topOrigY + topPlannedShift;
    const nodeFinalY = nodeOrigY + nodePlannedShift;
    return nodeFinalY < topFinalY ? nodeId : topId;
  }, intermediateNodeIds[0]);

  const topmostOriginalY = originalPositions.get(topmostNodeId);
  const topmostPlannedShift = nodeToPlannedShift.get(topmostNodeId) || 0;

  // The cleared space is created ABOVE the shifted node
  // If node is already planned to shift, we can potentially reuse that cleared space
  // Original node occupies: [originalY - NODE_HEIGHT/2, originalY + NODE_HEIGHT/2]
  // After shift by plannedShift, node occupies: [originalY + plannedShift - NODE_HEIGHT/2, ...]
  // Cleared space available: [originalY - NODE_HEIGHT/2, originalY + plannedShift - NODE_HEIGHT/2]

  const halfNodeHeight = NODE_HEIGHT / 2;
  const clearedSpaceTop =
    topmostOriginalY !== undefined
      ? topmostOriginalY - halfNodeHeight
      : edge.fromY;

  // If there's already a planned shift for this node, the cleared space extends further down
  // We can use this information to see if we need additional clearing
  const clearedSpaceBottom =
    topmostOriginalY !== undefined && topmostPlannedShift > 0
      ? topmostOriginalY + topmostPlannedShift - halfNodeHeight
      : clearedSpaceTop;

  // Use the dynamically allocated slot index
  const routingY = clearedSpaceTop + slotIndex * EDGE_VERTICAL_SPACING;

  // Log for debugging
  console.log(
    `[CollisionAvoidance] Edge ${patterns.find((p) => p.id === Number(edge.fromId))?.name}->${patterns.find((p) => p.id === Number(edge.toId))?.name}:`,
    `topNode=${patterns.find((p) => p.id === Number(topmostNodeId))?.name}, origY=${topmostOriginalY?.toFixed(1)},`,
    `plannedShift=${topmostPlannedShift}, slotIndex=${slotIndex}, routingY=${routingY.toFixed(1)},`,
    `clearedSpace=[${clearedSpaceTop.toFixed(1)}, ${clearedSpaceBottom.toFixed(1)}]`,
  );

  // Calculate X positions of first and last intermediate columns
  // These define where the curve should reach/leave the routing level
  const firstIntermediateDepth = edge.fromDepth + 1 - 0.25;
  const lastIntermediateDepth = edge.toDepth - 1 + 0.25;
  const firstIntermediateX =
    LEFT_MARGIN + firstIntermediateDepth * HORIZONTAL_SPACING;
  const lastIntermediateX =
    LEFT_MARGIN + lastIntermediateDepth * HORIZONTAL_SPACING;

  edgeToIntermediateNodes.set(edgeKey, {
    nodeIds: intermediateNodeIds,
    routingY: routingY,
    firstIntermediateX: firstIntermediateX,
    lastIntermediateX: lastIntermediateX,
  });
}

/**
 * Convert max slot indices to actual shift amounts
 * Node needs to shift by (maxSlot + 1) * EDGE_VERTICAL_SPACING
 * because slot 0 still needs EDGE_VERTICAL_SPACING of space
 * */
function convertToShiftNodes(nodeToMaxSlot: Map<number, number>) {
  const nodesToShift = new Map<number, number>(); // patternId -> vertical offset needed
  nodeToMaxSlot.forEach((maxSlot, nodeId) => {
    const shiftAmount = (maxSlot + 1) * EDGE_VERTICAL_SPACING;
    nodesToShift.set(nodeId, shiftAmount);
  });
  return nodesToShift;
}

function createNodesByDepthType(
  patterns: Pattern[],
  depthMap: Map<number, number>,
  positions: Map<number, LayoutPosition>,
) {
  const result = new Map<string, number[]>(); // "depth-type" -> [patternIds sorted by Y]
  patterns.forEach((pattern) => {
    const depth = depthMap.get(pattern.id) || 0;
    const key = `${depth}-${getType(pattern)}`;
    if (!result.has(key)) {
      result.set(key, []);
    }
    result.get(key)!.push(pattern.id);
  });

  // Sort each stack by Y position
  result.forEach((nodeIds) => {
    nodeIds.sort((a, b) => {
      const posA = positions.get(a);
      const posB = positions.get(b);
      if (!posA || !posB) return 0;
      return posA.y - posB.y;
    });
  });
  return result;
}

function calculateCumulativeShifts(
  nodesByDepthType: Map<string, number[]>,
  nodesToShift: Map<number, number>,
  positions: Map<number, LayoutPosition>,
  maxSlotPerType: Map<string, number>,
) {
  // Calculate cumulative shifts for each stack position
  // Key insight: to maintain equal spacing, each node must shift by the MAXIMUM
  // of (its own shift requirement) OR (the shift of the node directly above it)
  const cumulativeShifts = new Map<number, number>(); // patternId -> total shift to apply
  let maxShiftPerType = new Map<string, number>(); // "type" -> max shift in that swimlane

  nodesByDepthType.forEach((stack, key) => {
    // Extract type from "depth-type" key
    // Key format: "0-99c224c3-be49-4188-96a8-fd5cb20bd29d"
    // We need everything after the first dash
    const firstDashIndex = key.indexOf("-");
    const type = firstDashIndex >= 0 ? key.substring(firstDashIndex + 1) : key;
    let maxShiftInStack = 0;

    // Process from top to bottom to propagate shifts down
    let previousShift = 0;
    for (let i = 0; i < stack.length; i++) {
      const nodeId = stack[i];
      const ownShift = nodesToShift.get(nodeId) || 0;

      // This node shifts by the maximum of:
      // - Its own shift requirement
      // - The shift of the node above (to maintain spacing)
      const cumulativeShift = Math.max(ownShift, previousShift);

      cumulativeShifts.set(nodeId, cumulativeShift);
      maxShiftInStack = Math.max(maxShiftInStack, cumulativeShift);

      // Next node inherits this shift as minimum
      previousShift = cumulativeShift;
    }

    // Use the maximum of:
    // - The actual max shift in this stack
    // - The space needed for all slots (maxSlot + 1) * EDGE_VERTICAL_SPACING
    const maxSlotIndex = maxSlotPerType.get(type) ?? -1;
    const spaceNeededForSlots =
      maxSlotIndex >= 0 ? (maxSlotIndex + 1) * EDGE_VERTICAL_SPACING : 0;
    const finalMaxShift = Math.max(maxShiftInStack, spaceNeededForSlots);

    // Track max shift per swimlane type for height adjustment
    const currentMax = maxShiftPerType.get(type) || 0;
    maxShiftPerType.set(type, Math.max(currentMax, finalMaxShift));
  });

  // Apply the cumulative shifts
  cumulativeShifts.forEach((shift, nodeId) => {
    if (shift > 0) {
      const pos = positions.get(nodeId);
      if (pos) {
        positions.set(nodeId, { x: pos.x, y: pos.y + shift });
      }
    }
  });
  return maxShiftPerType;
}

/**
 * Build return array with edge information
 * */
function buildSkipLevelEdgeInfos(
  skipLevelEdges: IEdge[],
  edgeToIntermediateNodes: Map<string, IEdgeRoutingInfo>,
) {
  return skipLevelEdges.map((edge) => {
    const edgeKey = `${edge.fromId}-${edge.toId}`;
    const info = edgeToIntermediateNodes.get(edgeKey);
    return {
      fromId: edge.fromId,
      toId: edge.toId,
      fromDepth: edge.fromDepth,
      toDepth: edge.toDepth,
      intermediateNodeIds: info?.nodeIds || [],
      originalIntermediateY: info?.routingY || 0,
      firstIntermediateX: info?.firstIntermediateX || 0,
      lastIntermediateX: info?.lastIntermediateX || 0,
    };
  });
}
