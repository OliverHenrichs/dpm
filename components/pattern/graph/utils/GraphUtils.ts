import {
  NODE_HEIGHT,
  NODE_WIDTH,
} from "@/components/pattern/graph/types/Constants";
import { Pattern } from "@/components/pattern/types/PatternList";

export interface LayoutPosition {
  x: number;
  y: number;
}

export function generateEdges(patterns: Pattern[]) {
  return patterns.flatMap((pattern) =>
    pattern.prerequisites.map((prereqId) => ({
      from: prereqId,
      to: pattern.id,
    })),
  );
}

/**
 * Detect circular dependencies in the pattern graph.
 * Returns an array of cycles (each cycle is an array of pattern ids).
 * Logs warnings for each detected cycle.
 */
export function detectCircularDependencies(patterns: Pattern[]): number[][] {
  const cycles: number[][] = [];
  const patternMap = new Map<number, Pattern>();
  patterns.forEach((p) => patternMap.set(p.id, p));

  function findCycles(
    patternId: number,
    visited: Set<number>,
    path: number[],
  ): void {
    if (visited.has(patternId)) {
      // Found a cycle
      const cycleStart = path.indexOf(patternId);
      if (cycleStart !== -1) {
        const cycle = path.slice(cycleStart);
        cycles.push(cycle);
        console.warn(
          `Warning: Circular dependency detected between patterns: ${cycle.join(" -> ")}`,
        );
      }
      return;
    }

    const pattern = patternMap.get(patternId);
    if (!pattern) return;

    visited.add(patternId);
    path.push(patternId);

    pattern.prerequisites.forEach((prereqId) => {
      findCycles(prereqId, new Set(visited), [...path]);
    });
  }

  patterns.forEach((p) => findCycles(p.id, new Set(), []));

  return cycles;
}

/**
 * Represents a side of a rectangular node
 */
enum NodeSide {
  TOP = "top",
  RIGHT = "right",
  BOTTOM = "bottom",
  LEFT = "left",
}

/**
 * Calculate the prerequisite depth for each pattern using DFS.
 * Depth is the longest chain from foundational patterns (prerequisites: []).
 * Returns a map of pattern id -> depth.
 */
export function calculatePrerequisiteDepthMap(
  patterns: Pattern[],
): Map<number, number> {
  const depthMap = new Map<number, number>();
  const patternMap = new Map<number, Pattern>();

  // Create pattern lookup map
  patterns.forEach((pattern) => patternMap.set(pattern.id, pattern));

  function getDepth(
    patternId: number,
    visited: Set<number> = new Set(),
  ): number {
    // Check if already calculated
    if (depthMap.has(patternId)) {
      return depthMap.get(patternId)!;
    }

    // Detect circular dependency
    if (visited.has(patternId)) {
      return 0; // Break cycle
    }

    const pattern = patternMap.get(patternId);
    if (!pattern) return 0;

    // Foundational pattern (no prerequisites)
    if (pattern.prerequisites.length === 0) {
      depthMap.set(patternId, 0);
      return 0;
    }

    // Calculate depth as max prerequisite depth + 1
    visited.add(patternId);
    const maxPrereqDepth = Math.max(
      ...pattern.prerequisites.map((prereqId) => getDepth(prereqId, visited)),
    );
    const depth = maxPrereqDepth + 1;
    depthMap.set(patternId, depth);

    return depth;
  }

  // Calculate depth for all patterns
  patterns.forEach((p) => getDepth(p.id));

  return depthMap;
}

/**
 * Generate SVG path string for an orthogonal edge between two nodes.
 * The path starts perpendicular to the source side and ends perpendicular to the target side.
 */
export function generateOrthogonalPath(
  fromPos: LayoutPosition,
  toPos: LayoutPosition,
): string {
  // Determine which sides to connect
  const fromSide = getClosestSide(fromPos, toPos);
  const toSide = getClosestSide(toPos, fromPos);

  const startPoint = getConnectionPoint(fromPos, fromSide);
  const endPoint = getConnectionPoint(toPos, toSide);
  const adjustedEndPoint = adjustEndpointForArrow(toSide, endPoint);
  const orthogonalOffset = getOrthogonalOffset(adjustedEndPoint, startPoint);
  let cp1 = getControlPoint(fromSide, startPoint, orthogonalOffset);
  let cp2 = getControlPoint(toSide, adjustedEndPoint, orthogonalOffset);

  // Use cubic Bézier curve (C command) for smooth, continuous curve
  // This creates a smooth curve from start to end with orthogonal tangents at both ends
  return `M ${startPoint.x} ${startPoint.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${adjustedEndPoint.x} ${adjustedEndPoint.y}`;
}

/**
 * Generate optimized SVG path for skip-level edges that routes through cleared space.
 * The path takes advantage of vertically shifted intermediate nodes by routing below them.
 * Curves complete at the first intermediate column and start at the last intermediate column.
 */
export function generateSkipLevelPath(
  fromPos: LayoutPosition,
  toPos: LayoutPosition,
  originalIntermediateY: number, // Y coordinate where edge should route
  firstIntermediateX: number, // X position of first intermediate column
  lastIntermediateX: number, // X position of last intermediate column
): string {
  const fromSide = getClosestSide(fromPos, toPos);
  const toSide = getClosestSide(toPos, fromPos);

  const startPoint = getConnectionPoint(fromPos, fromSide);
  const endPoint = getConnectionPoint(toPos, toSide);
  const adjustedEndPoint = adjustEndpointForArrow(toSide, endPoint);

  const routingY = originalIntermediateY;

  // Curve should reach routing level AT the first intermediate column X position
  // and leave routing level AT the last intermediate column X position
  const segment1EndX = firstIntermediateX;
  const segment2EndX = lastIntermediateX;

  const distanceFactor = 0.7; // Control point distance factor for smoothness
  // First segment: start to routing level (curve down)
  // Control points create smooth curve from start to first intermediate column
  const distance1 = segment1EndX - startPoint.x;
  const cp1X = startPoint.x + distance1 * distanceFactor;
  const cp1Y = startPoint.y;
  const cp2X = segment1EndX - distance1 * distanceFactor;
  const cp2Y = routingY;

  // Second segment: horizontal at routing level (straight line through cleared space)
  // This travels from first intermediate column to last intermediate column

  // Third segment: routing level to end (curve up)
  // Control points create smooth curve from last intermediate column to end
  const distance2 = adjustedEndPoint.x - segment2EndX;
  const cp3X = segment2EndX + distance2 * distanceFactor;
  const cp3Y = routingY;
  const cp4X = adjustedEndPoint.x - distance2 * distanceFactor;
  const cp4Y = adjustedEndPoint.y;

  // Build path with explicit cubic Bézier curves
  return `M ${startPoint.x} ${startPoint.y} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${segment1EndX} ${routingY} L ${segment2EndX} ${routingY} C ${cp3X} ${cp3Y}, ${cp4X} ${cp4Y}, ${adjustedEndPoint.x} ${adjustedEndPoint.y}`;
}

/**
 * Calculate which side of a node is closest to a target point
 */
function getClosestSide(
  nodePos: LayoutPosition,
  targetPos: LayoutPosition,
): NodeSide {
  const dx = targetPos.x - nodePos.x;
  const dy = targetPos.y - nodePos.y;

  // Use the direction with the larger absolute value to determine the side
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? NodeSide.RIGHT : NodeSide.LEFT;
  } else {
    return dy > 0 ? NodeSide.BOTTOM : NodeSide.TOP;
  }
}

/**
 * Get the connection point on a specific side of a node
 */
function getConnectionPoint(
  nodePos: LayoutPosition,
  side: NodeSide,
): LayoutPosition {
  switch (side) {
    case NodeSide.TOP:
      return { x: nodePos.x, y: nodePos.y - NODE_HEIGHT / 2 };
    case NodeSide.RIGHT:
      return { x: nodePos.x + NODE_WIDTH / 2, y: nodePos.y };
    case NodeSide.BOTTOM:
      return { x: nodePos.x, y: nodePos.y + NODE_HEIGHT / 2 };
    case NodeSide.LEFT:
      return { x: nodePos.x - NODE_WIDTH / 2, y: nodePos.y };
  }
}

/**
 * The arrow has a size and needs space to render properly.
 * Adjust the endpoint of the path to create space for the arrowhead.
 */
function adjustEndpointForArrow(
  toSide: NodeSide,
  endPoint: LayoutPosition,
): LayoutPosition {
  // Arrow size - move endpoint away from box so arrow can extend to touch box surface
  const arrowSize = 20;

  // Adjust end point: move it AWAY from the box by arrow size
  // This creates space for the arrow to extend from path endpoint to box surface
  let adjustedEndPoint: LayoutPosition;
  switch (toSide) {
    case NodeSide.TOP:
      adjustedEndPoint = { x: endPoint.x, y: endPoint.y - arrowSize };
      break;
    case NodeSide.RIGHT:
      adjustedEndPoint = { x: endPoint.x + arrowSize, y: endPoint.y };
      break;
    case NodeSide.BOTTOM:
      adjustedEndPoint = { x: endPoint.x, y: endPoint.y + arrowSize };
      break;
    case NodeSide.LEFT:
      adjustedEndPoint = { x: endPoint.x - arrowSize, y: endPoint.y };
      break;
  }
  return adjustedEndPoint;
}

/**
 * Calculate orthogonal offset for control points based on distance between start and end points.
 * Ensures the curve has a smooth bend without being too sharp or too flat.
 */
function getOrthogonalOffset(
  adjustedEndPoint: LayoutPosition,
  startPoint: LayoutPosition,
): number {
  const dx = adjustedEndPoint.x - startPoint.x;
  const dy = adjustedEndPoint.y - startPoint.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  // Use 30% of the distance as the control point offset, with min/max bounds
  return Math.min(Math.max(distance * 0.3, 30), 100);
}

function getControlPoint(
  toSide: NodeSide,
  position: LayoutPosition,
  offset: number,
) {
  switch (toSide) {
    case NodeSide.TOP:
      return {
        x: position.x,
        y: position.y - offset,
      };
    case NodeSide.RIGHT:
      return {
        x: position.x + offset,
        y: position.y,
      };
    case NodeSide.BOTTOM:
      return {
        x: position.x,
        y: position.y + offset,
      };
    case NodeSide.LEFT:
      return {
        x: position.x - offset,
        y: position.y,
      };
  }
}
