import {
  calculatePrerequisiteDepthMap,
  LayoutPosition,
} from "@/components/pattern/graph/utils/GraphUtils";
import { Pattern } from "@/components/pattern/types/PatternList";

/**
 * Calculate layout positions for network graph view.
 * Uses elliptical layout for foundational nodes, with dependencies
 * spreading radially outward perpendicular to the ellipse's surface.
 */
export function calculateGraphLayout(
  patterns: Pattern[],
  width: number,
  height: number,
): Map<number, LayoutPosition> {
  const depthMap = calculatePrerequisiteDepthMap(patterns);
  const foundationalPatterns = getFoundationalPatterns(patterns, depthMap);
  const positions = calculateFoundationalPatternPositions(
    width,
    height,
    foundationalPatterns,
  );

  // Build dependency tree for each foundational pattern
  const patternMap = new Map<number, Pattern>();
  patterns.forEach((p) => patternMap.set(p.id, p));

  // For each foundational pattern, position its descendants radially
  foundationalPatterns.forEach((foundational, index) => {
    const descendants = collectDescendants(foundational.id, patterns, depthMap);
    const angle = (index / foundationalPatterns.length) * 2 * Math.PI;
    const foundationalPos = positions.get(foundational.id)!;
    calculateDescendantPatternPositions(
      descendants,
      angle,
      foundationalPos,
      positions,
    );
  });

  addSizeSafeguards(positions);
  return positions;
}

function calculateFoundationalPatternPositions(
  width: number,
  height: number,
  foundationalPatterns: Pattern[],
) {
  // Ellipse parameters (leave room for dependencies)
  const ellipseRadiusX = Math.min(width * 0.25, 400);
  const ellipseRadiusY = Math.min(height * 0.25, 300);

  // Center of the layout
  const centerX = width;
  const centerY = height;
  const positions = new Map<number, LayoutPosition>();
  // Position foundational patterns around the ellipse
  foundationalPatterns.forEach((pattern, index) => {
    const angle = (index / foundationalPatterns.length) * 2 * Math.PI;

    // Position on ellipse
    const x = centerX + ellipseRadiusX * Math.cos(angle);
    const y = centerY + ellipseRadiusY * Math.sin(angle);

    positions.set(pattern.id, { x, y });
  });
  return positions;
}

function getFoundationalPatterns(
  patterns: Pattern[],
  depthMap: Map<number, number>,
) {
  return patterns.filter((p) => (depthMap.get(p.id) || 0) === 0);
}

function collectDescendants(
  patternId: number,
  patterns: Pattern[],
  depthMap: Map<number, number>,
  descendants?: Map<number, Pattern[]>,
) {
  if (!descendants) {
    descendants = new Map<number, Pattern[]>();
  }
  patterns.forEach((p) => {
    if (p.prerequisites.includes(patternId)) {
      const depth = depthMap.get(p.id) || 0;
      if (!descendants.has(depth)) {
        descendants.set(depth, []);
      }
      descendants.get(depth)!.push(p);
      collectDescendants(p.id, patterns, depthMap, descendants);
    }
  });
  return descendants;
}

function calculateDescendantPatternPositions(
  descendants: Map<number, Pattern[]>,
  angle: number,
  foundationalPos: LayoutPosition,
  positions: Map<number, LayoutPosition>,
) {
  // Spacing between depth levels
  const depthSpacing = 200;
  // Cap maximum distance to prevent extreme positions
  const MAX_DISTANCE = 2000;

  // Position descendants at each depth level
  descendants.forEach((patternsAtDepth, depth) => {
    patternsAtDepth.forEach((pattern, idx) => {
      // Distance from foundational pattern (capped to prevent extreme values)
      const distance = Math.min(depth * depthSpacing, MAX_DISTANCE);

      // Spread patterns at this depth perpendicular to the radial direction
      // Calculate perpendicular offset for multiple patterns at same depth
      const numAtDepth = patternsAtDepth.length;
      const spreadAngle = numAtDepth > 1 ? Math.PI / 6 : 0; // 30 degrees spread
      const offsetAngle =
        numAtDepth > 1
          ? (idx - (numAtDepth - 1) / 2) * (spreadAngle / (numAtDepth - 1))
          : 0;

      // Calculate position along the radial direction with perpendicular offset
      const finalAngle = angle + offsetAngle;
      const finalDirX = Math.cos(finalAngle);
      const finalDirY = Math.sin(finalAngle);

      const x = foundationalPos.x + finalDirX * distance;
      const y = foundationalPos.y + finalDirY * distance;

      positions.set(pattern.id, { x, y });
    });
  });
}

function addSizeSafeguards(positions: Map<number, LayoutPosition>) {
  // Clamp all positions to reasonable bounds to prevent excessive canvas size
  // This prevents "Canvas: trying to draw too large bitmap" errors
  const MAX_COORDINATE = 3000;
  positions.forEach((pos) => {
    pos.x = Math.max(-MAX_COORDINATE, Math.min(MAX_COORDINATE, pos.x));
    pos.y = Math.max(-MAX_COORDINATE, Math.min(MAX_COORDINATE, pos.y));
  });
}
