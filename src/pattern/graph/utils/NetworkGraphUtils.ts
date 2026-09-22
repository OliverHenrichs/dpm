import { LayoutPosition } from "@/src/pattern/graph/utils/GraphUtils";
import { IPattern } from "@/src/pattern/types/IPatternList";
import {
  buildAdjacency,
  buildDepthMap,
} from "@/src/pattern/graph/model/adjacency";
import {
  DEPTH_SPACING,
  MAX_GRAPH_COORDINATE,
} from "@/src/pattern/graph/types/Constants";

/**
 * ~137.5°. Stepping by it spreads successive points evenly around a circle
 * without any two landing close together, which is what keeps unanchored
 * nodes from stacking on top of each other.
 */
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/** Shared by the foundational ring and the unanchored-node fallback. */
function getEllipseRadii(width: number, height: number) {
  return {
    ellipseRadiusX: Math.min(width * 0.3, 500),
    ellipseRadiusY: Math.min(height * 0.3, 400),
  };
}

export interface GraphLayout {
  positions: Map<number, LayoutPosition>;
  /** The center of the foundational ellipse in the same coordinate space as positions. */
  ellipseCenterX: number;
  ellipseCenterY: number;
}

/**
 * Calculate layout positions for network graph view.
 * Uses elliptical layout for foundational nodes, with dependencies
 * spreading radially outward from each foundational node.
 *
 * Each non-foundational pattern is positioned exactly once, by the
 * foundational ancestor that reaches it via the shortest prerequisite path
 * (BFS order). Angles are derived from the direct parent's outward direction,
 * never accumulated across the full chain, so multi-parent nodes stay
 * close to the sector they naturally belong to.
 */
export function calculateGraphLayout(
  patterns: IPattern[],
  width: number,
  height: number,
): GraphLayout {
  const depthMap = buildDepthMap(buildAdjacency(patterns));
  const foundationalPatterns = getFoundationalPatterns(patterns, depthMap);

  const centerX = width / 2;
  const centerY = height / 2;

  const { positions, foundationalAngles } =
    calculateFoundationalPatternPositions(
      centerX,
      centerY,
      width,
      height,
      foundationalPatterns,
    );

  // Shared set: first DFS visitor to claim a node wins.
  // This handles multi-parent nodes: only the first (shortest DFS path) placement sticks.
  const positioned = new Set<number>(foundationalPatterns.map((p) => p.id));

  // Angular spread per child: inversely proportional to child count so that
  // fewer children fan out wider and more children pack tighter.
  // Clamped between MIN (avoid total collapse) and MAX (avoid full-circle wrap).
  const MIN_ANGLE_PER_NODE = Math.PI / 12; // 15° — floor for dense groups
  const MAX_ANGLE_PER_NODE = Math.PI / 1.5; // 60° — ceiling for sparse groups

  /**
   * Recursively place all children of `parentId` radially outward from `parentPos`
   * along `parentAngle`, then immediately recurse into each child's subtree (DFS).
   *
   * A pattern is only eligible as a child of `parentId` if:
   *   (a) it lists `parentId` as a prerequisite,
   *   (b) it has not been positioned yet, AND
   *   (c) ALL of its other prerequisites are already positioned.
   *
   * Rule (c) ensures that a node which is both a direct child and a grandchild
   * (e.g. node→grandchild AND node→child→grandchild) is NOT placed by `node`'s
   * pass — because `child` is not yet positioned at that point — and instead
   * falls naturally into `child`'s pass one ring further out.
   */
  function placeChildren(
    parentId: number,
    parentPos: LayoutPosition,
    parentAngle: number,
  ) {
    const children = patterns.filter(
      (p) =>
        p.prerequisites.includes(parentId) &&
        !positioned.has(p.id) &&
        p.prerequisites.every((prereqId) => positioned.has(prereqId)),
    );

    // Claim all children before recursing so that sibling cross-links don't
    // cause one sibling to be placed as a child of another sibling.
    children.forEach((child) => positioned.add(child.id));

    const numChildren = children.length;
    const anglePerNode = Math.min(
      MAX_ANGLE_PER_NODE,
      Math.max(
        MIN_ANGLE_PER_NODE,
        MAX_ANGLE_PER_NODE / Math.max(numChildren, 1),
      ),
    );
    const spreadAngle = numChildren > 1 ? (numChildren - 1) * anglePerNode : 0;

    children.forEach((child, idx) => {
      const offsetAngle =
        numChildren > 1
          ? (idx - (numChildren - 1) / 2) * (spreadAngle / (numChildren - 1))
          : 0;

      const finalAngle = parentAngle + offsetAngle;
      const x = parentPos.x + Math.cos(finalAngle) * DEPTH_SPACING;
      const y = parentPos.y + Math.sin(finalAngle) * DEPTH_SPACING;
      positions.set(child.id, { x, y });

      // DFS: fully place this child's subtree before moving to next sibling.
      placeChildren(child.id, { x, y }, finalAngle);
    });
  }

  foundationalPatterns.forEach((foundational, index) => {
    placeChildren(
      foundational.id,
      positions.get(foundational.id)!,
      foundationalAngles[index],
    );
  });

  /**
   * Place `p` between whichever of its prerequisites are already positioned,
   * pushed one ring further out, and return the outward angle so the caller
   * can lay out its children along the same direction.
   *
   * With no positioned prerequisite to hang off there is nothing to anchor to,
   * so the node goes on a ring outside the foundational ellipse, stepped by
   * the golden angle to keep successive ones from stacking.
   */
  function placeFromAnchors(
    p: IPattern,
    anchors: LayoutPosition[],
    unanchoredIndex: number,
  ): number {
    if (anchors.length === 0) {
      const { ellipseRadiusX, ellipseRadiusY } = getEllipseRadii(width, height);
      const angle = (unanchoredIndex * GOLDEN_ANGLE) % (2 * Math.PI);
      const radius =
        Math.max(ellipseRadiusX, ellipseRadiusY) + DEPTH_SPACING * 2;
      positions.set(p.id, {
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
      });
      return angle;
    }

    const avgX = anchors.reduce((s, pos) => s + pos.x, 0) / anchors.length;
    const avgY = anchors.reduce((s, pos) => s + pos.y, 0) / anchors.length;
    // Outward direction from ellipse centre
    const dx = avgX - centerX;
    const dy = avgY - centerY;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    positions.set(p.id, {
      x: avgX + (dx / len) * DEPTH_SPACING,
      y: avgY + (dy / len) * DEPTH_SPACING,
    });
    return Math.atan2(dy, dx);
  }

  const positionedPrereqsOf = (p: IPattern) =>
    p.prerequisites
      .map((id) => positions.get(id))
      .filter((pos): pos is LayoutPosition => pos !== undefined);

  // Deferred pass: some nodes require prerequisites from multiple DFS sectors
  // and may still be unpositioned. Retry until no more nodes can be placed.
  let progress = true;
  while (progress) {
    progress = false;
    patterns.forEach((p) => {
      if (
        !positioned.has(p.id) &&
        p.prerequisites.every((prereqId) => positioned.has(prereqId))
      ) {
        positioned.add(p.id);
        progress = true;
        const angle = placeFromAnchors(p, positionedPrereqsOf(p), 0);
        placeChildren(p.id, positions.get(p.id)!, angle);
      }
    });
  }

  // Fallback pass — now a deep safety net rather than the first line of
  // defence. Since depth comes from the model's adjacency index, which drops
  // prerequisites that match no pattern, a node whose prerequisites are all
  // missing or cyclic scores depth 0 and is treated as a root: it lands on the
  // ellipse with the other roots, which is where it belongs, instead of being
  // rescued onto a ring out here.
  //
  // What remains is anything the DFS and deferred passes still cannot reach.
  // Keeping it costs nothing and the invariant it protects — every node given
  // to this function gets a position — is the one whose violation made
  // patterns silently vanish (AGENT_TASKS.md B1/B2).
  //
  // Neither is supposed to happen, and both are now prevented at the source,
  // but data written by older builds still contains them — and a node this
  // function declines to position is simply never drawn. It vanishes from the
  // graph along with everything downstream of it, silently, while the timeline
  // view still lists it. Placing it imperfectly beats losing it.
  let unanchoredIndex = 0;
  patterns.forEach((p) => {
    if (positioned.has(p.id)) return;
    positioned.add(p.id);
    const anchors = positionedPrereqsOf(p);
    const angle = placeFromAnchors(
      p,
      anchors,
      anchors.length === 0 ? unanchoredIndex++ : 0,
    );
    placeChildren(p.id, positions.get(p.id)!, angle);
  });

  addSizeSafeguards(positions);
  return { positions, ellipseCenterX: centerX, ellipseCenterY: centerY };
}

function calculateFoundationalPatternPositions(
  centerX: number,
  centerY: number,
  width: number,
  height: number,
  foundationalPatterns: IPattern[],
): { positions: Map<number, LayoutPosition>; foundationalAngles: number[] } {
  // Larger ellipse radii so the ring isn't cramped
  const { ellipseRadiusX, ellipseRadiusY } = getEllipseRadii(width, height);

  const positions = new Map<number, LayoutPosition>();
  const foundationalAngles: number[] = [];

  foundationalPatterns.forEach((pattern, index) => {
    const angle = (index / foundationalPatterns.length) * 2 * Math.PI;
    foundationalAngles.push(angle);

    const x = centerX + ellipseRadiusX * Math.cos(angle);
    const y = centerY + ellipseRadiusY * Math.sin(angle);
    positions.set(pattern.id, { x, y });
  });

  return { positions, foundationalAngles };
}

function getFoundationalPatterns(
  patterns: IPattern[],
  depthMap: Map<number, number>,
) {
  return patterns.filter((p) => (depthMap.get(p.id) || 0) === 0);
}

function addSizeSafeguards(positions: Map<number, LayoutPosition>) {
  // Clamp all positions to reasonable bounds to prevent excessive canvas size.
  // This prevents "Canvas: trying to draw too large bitmap" errors.
  const MAX_COORDINATE = MAX_GRAPH_COORDINATE;
  positions.forEach((pos) => {
    pos.x = Math.max(-MAX_COORDINATE, Math.min(MAX_COORDINATE, pos.x));
    pos.y = Math.max(-MAX_COORDINATE, Math.min(MAX_COORDINATE, pos.y));
  });
}
