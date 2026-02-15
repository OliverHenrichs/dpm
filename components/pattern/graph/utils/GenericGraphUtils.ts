import { NODE_WIDTH } from "@/components/pattern/graph/types/Constants";

export interface LayoutPosition {
  x: number;
  y: number;
}

// Type that can be either Pattern or WCSPattern (for backward compatibility)
interface PatternLike {
  id: number;
  prerequisites: number[];
}

export function generateEdges<T extends PatternLike>(patterns: T[]) {
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
export function detectCircularDependencies<T extends PatternLike>(
  patterns: T[],
): number[][] {
  const cycles: number[][] = [];
  const patternMap = new Map<number, T>();
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
export function calculatePrerequisiteDepthMap<T extends PatternLike>(
  patterns: T[],
): Map<number, number> {
  const depthMap = new Map<number, number>();
  const patternMap = new Map<number, T>();

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

    // Calculate depth as 1 + max depth of all prerequisites
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
 * Calculate the entry and exit points on the perimeter of a rectangular node.
 * Entry is always on the left side, exit on the right side for horizontal flow.
 */
function getNodeConnectorPoints(pos: LayoutPosition): {
  entry: { x: number; y: number };
  exit: { x: number; y: number };
} {
  return {
    entry: { x: pos.x - NODE_WIDTH / 2, y: pos.y },
    exit: { x: pos.x + NODE_WIDTH / 2, y: pos.y },
  };
}

/**
 * Generate orthogonal path between two nodes (from -> to).
 * Path starts from exit point of fromPos and ends at entry point of toPos.
 */
export function generateOrthogonalPath(
  fromPos: LayoutPosition,
  toPos: LayoutPosition,
): string {
  const { exit: start } = getNodeConnectorPoints(fromPos);
  const { entry: end } = getNodeConnectorPoints(toPos);

  // Horizontal gap and vertical gap
  const hGap = end.x - start.x;
  const vGap = end.y - start.y;

  // If nodes are horizontally aligned (same y) or nearly so
  if (Math.abs(vGap) < 10) {
    return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
  }

  // Standard orthogonal routing: horizontal -> vertical -> horizontal
  const midX = start.x + hGap / 2;

  return `M ${start.x} ${start.y} L ${midX} ${start.y} L ${midX} ${end.y} L ${end.x} ${end.y}`;
}

/**
 * Generate path for skip-level edges that route through cleared space.
 */
export function generateSkipLevelPath(
  fromPos: LayoutPosition,
  toPos: LayoutPosition,
  routingY: number,
  firstIntermediateX: number,
  lastIntermediateX: number,
): string {
  const { exit: start } = getNodeConnectorPoints(fromPos);
  const { entry: end } = getNodeConnectorPoints(toPos);

  // Route down, across, then up
  return `M ${start.x} ${start.y} 
          L ${firstIntermediateX} ${start.y} 
          L ${firstIntermediateX} ${routingY} 
          L ${lastIntermediateX} ${routingY} 
          L ${lastIntermediateX} ${end.y} 
          L ${end.x} ${end.y}`;
}
