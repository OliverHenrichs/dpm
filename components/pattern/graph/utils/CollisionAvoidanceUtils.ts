import { WCSPattern } from "@/components/pattern/types/WCSPattern";
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

/**
 * Apply collision avoidance by detecting skip-level edges and shifting intermediate nodes.
 * This is a second pass after initial positioning.
 * Returns information about skip-level edges, which nodes were shifted, and max shifts per type.
 */
export function applyCollisionAvoidance(
  patterns: (WCSPattern | Pattern)[],
  depthMap: Map<number, number>,
  positions: Map<number, LayoutPosition>,
): {
  skipLevelEdgeInfos: SkipLevelEdgeInfo[];
  maxShiftPerType: Map<string, number>;
} {
  const patternMap = new Map<number, WCSPattern | Pattern>();
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

  // For each skip-level edge, find intermediate nodes that would be crossed
  const nodeToMaxSlot = new Map<number, number>(); // patternId -> max slot index of edges crossing it
  const edgeToIntermediateNodes = new Map<string, IEdgeRoutingInfo>(); // "fromId-toId" -> {intermediateNodeIds, routingY, column positions}

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
      nodeToMaxSlot,
    );

    // Calculate routing Y based on the cleared space created by shifting nodes
    if (intermediateNodeIds.length > 0) {
      calculateEdgeYRouting(
        edge,
        intermediateNodeIds,
        originalPositions,
        edgeToIntermediateNodes,
      );
    }
  });

  const nodesToShift = convertToShiftNodes(nodeToMaxSlot);
  const nodesByDepthType = createNodesByDepthType(
    patterns,
    depthMap,
    positions,
  );
  const maxShiftPerType = calculateCumulativeShifts(
    nodesByDepthType,
    nodesToShift,
    positions,
  );
  const skipLevelEdgeInfos = buildSkipLevelEdgeInfos(
    skipLevelEdges,
    edgeToIntermediateNodes,
  );
  return { skipLevelEdgeInfos, maxShiftPerType };
}

function hasSameType(
  prereqPattern: Pattern | WCSPattern,
  pattern: Pattern | WCSPattern,
): boolean {
  return (
    (prereqPattern as WCSPattern).type === (pattern as WCSPattern).type ||
    (prereqPattern as Pattern).typeId === (pattern as Pattern).typeId
  );
}

function getType(source?: WCSPattern | Pattern): string | undefined {
  if (!source) return undefined;
  return (source as WCSPattern).type ?? (source as Pattern).typeId;
}

function findSkipLevelEdges(
  patterns: (WCSPattern | Pattern)[],
  depthMap: Map<number, number>,
  positions: Map<number, LayoutPosition>,
  patternMap: Map<number, Pattern | WCSPattern>,
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
      if (!prereqPattern || !hasSameType(prereqPattern, pattern)) return;

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

function getIntersectingIntermediateNodes(
  edge: IEdge,
  patterns: (WCSPattern | Pattern)[],
  edgeType: string,
  depthMap: Map<number, number>,
  positions: Map<number, LayoutPosition>,
  nodeToMaxSlot: Map<number, number>,
) {
  const result: number[] = [];

  // Calculate slot for this edge based on its depth span
  const depthSpan = edge.toDepth - edge.fromDepth;
  const slotIndex = Math.max(0, 3 - depthSpan);

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
        // Track the maximum slot index for this node
        const currentMaxSlot = nodeToMaxSlot.get(intermediatePattern.id) || -1;
        nodeToMaxSlot.set(
          intermediatePattern.id,
          Math.max(currentMaxSlot, slotIndex),
        );
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
  edgeToIntermediateNodes: Map<string, IEdgeRoutingInfo>,
) {
  const edgeKey = `${edge.fromId}-${edge.toId}`;

  // Find the topmost intermediate node (before shifting)
  const topmostNodeId = intermediateNodeIds.reduce((topId, nodeId) => {
    const topOrigY = originalPositions.get(topId) || Infinity;
    const nodeOrigY = originalPositions.get(nodeId) || Infinity;
    return nodeOrigY < topOrigY ? nodeId : topId;
  }, intermediateNodeIds[0]);

  const topmostOriginalY = originalPositions.get(topmostNodeId);

  // The cleared space is created ABOVE the shifted node
  // Original node occupies: [originalY - NODE_HEIGHT/2, originalY + NODE_HEIGHT/2]
  // After shift by shiftAmount, node occupies: [originalY + shiftAmount - NODE_HEIGHT/2, ...]
  // Cleared space is: [originalY - NODE_HEIGHT/2, originalY + shiftAmount - NODE_HEIGHT/2]

  const halfNodeHeight = NODE_HEIGHT / 2;
  const clearedSpaceTop =
    topmostOriginalY !== undefined
      ? topmostOriginalY - halfNodeHeight
      : edge.fromY;

  // Longer edges (spanning more columns) route higher to avoid later intersections
  // Divide cleared space into slots based on depth span
  // Edge spanning 3 columns gets slot 0 (highest), spanning 2 gets slot 1, etc.
  const depthSpan = edge.toDepth - edge.fromDepth;
  const slotHeight = EDGE_VERTICAL_SPACING;
  const slotIndex = Math.max(0, 3 - depthSpan); // Invert: longer span = lower index = higher position
  const routingY = clearedSpaceTop + slotIndex * slotHeight;

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
  patterns: (WCSPattern | Pattern)[],
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
) {
  // Calculate cumulative shifts for each stack position
  // Key insight: to maintain equal spacing, each node must shift by the MAXIMUM
  // of (its own shift requirement) OR (the shift of the node directly above it)
  const cumulativeShifts = new Map<number, number>(); // patternId -> total shift to apply
  let maxShiftPerType = new Map<string, number>(); // "type" -> max shift in that swimlane

  nodesByDepthType.forEach((stack, key) => {
    const type = key.split("-")[1]; // Extract type from "depth-type"
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

    // Track max shift per swimlane type for height adjustment
    const currentMax = maxShiftPerType.get(type) || 0;
    maxShiftPerType.set(type, Math.max(currentMax, maxShiftInStack));
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
