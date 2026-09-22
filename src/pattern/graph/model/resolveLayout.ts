import { IPattern } from "@/src/pattern/types/IPatternList";
import { LayoutPosition } from "@/src/pattern/graph/utils/GraphUtils";
import {
  DEPTH_SPACING,
  MAX_GRAPH_COORDINATE,
  MIN_GRAPH_COORDINATE,
} from "@/src/pattern/graph/types/Constants";
import { buildAdjacency } from "./adjacency";

/** A manual layout as it is stored. Coordinates are graph-space, pre-zoom. */
export interface StoredGraphLayout {
  version: number;
  /** Pattern id (as a string, because JSON object keys are strings) → point. */
  positions: Record<string, { x: number; y: number }>;
  updatedAt: number;
}

export const GRAPH_LAYOUT_VERSION = 1;

export interface ResolvedLayout {
  positions: Map<number, LayoutPosition>;
  /** Stored ids with no matching pattern. The caller prunes these. */
  staleIds: number[];
  /** Ids placed automatically because nothing was stored for them. */
  seededIds: number[];
}

/** ~137.5°: successive multiples never land close together. */
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/**
 * Keep a position inside the drawable canvas.
 *
 * Both ends matter. Past the far edge a node is outside the SVG; past the near
 * edge it is at a negative coordinate. Either way it is not drawn, and there
 * is then no way to drag it back.
 */
function clampCoordinate(value: number): number {
  if (!Number.isFinite(value)) return MIN_GRAPH_COORDINATE;
  return Math.max(MIN_GRAPH_COORDINATE, Math.min(MAX_GRAPH_COORDINATE, value));
}

function isPoint(value: unknown): value is { x: number; y: number } {
  if (typeof value !== "object" || value === null) return false;
  const point = value as { x?: unknown; y?: unknown };
  return typeof point.x === "number" && typeof point.y === "number";
}

/**
 * Where to put a pattern that has no stored position.
 *
 * Near its prerequisites if any of them are placed, otherwise near its
 * dependents, otherwise just outside everything already on screen. **Never by
 * re-running the global layout** — that is the point of this whole function.
 * Adding one pattern must not reshuffle an arrangement the user built by hand,
 * and a global re-layout would move every node.
 */
function seedPosition(
  pattern: IPattern,
  anchors: number[],
  placed: Map<number, LayoutPosition>,
  index: number,
): LayoutPosition {
  const known = anchors
    .map((id) => placed.get(id))
    .filter((position): position is LayoutPosition => position !== undefined);

  if (known.length > 0) {
    // Between its anchors, then pushed out by one level so it does not land
    // on top of them — or on top of a sibling seeded in the same pass.
    const avgX = known.reduce((sum, p) => sum + p.x, 0) / known.length;
    const avgY = known.reduce((sum, p) => sum + p.y, 0) / known.length;
    const angle = index * GOLDEN_ANGLE;
    return {
      x: clampCoordinate(avgX + Math.cos(angle) * DEPTH_SPACING),
      y: clampCoordinate(avgY + Math.sin(angle) * DEPTH_SPACING),
    };
  }

  // Nothing to hang it off: ring it around whatever is already there, so it is
  // visible rather than stacked at the origin under another node.
  const all = [...placed.values()];
  const centreX = all.length
    ? all.reduce((sum, p) => sum + p.x, 0) / all.length
    : 0;
  const centreY = all.length
    ? all.reduce((sum, p) => sum + p.y, 0) / all.length
    : 0;
  const radius = all.reduce(
    (max, p) => Math.max(max, Math.hypot(p.x - centreX, p.y - centreY)),
    0,
  );
  const angle = index * GOLDEN_ANGLE;
  return {
    x: clampCoordinate(centreX + Math.cos(angle) * (radius + DEPTH_SPACING)),
    y: clampCoordinate(centreY + Math.sin(angle) * (radius + DEPTH_SPACING)),
  };
}

/**
 * Merge a stored manual layout with the patterns that exist now.
 *
 * Three cases, and the middle one is the whole reason this is a function
 * rather than a spread:
 *
 * - A pattern with a stored position keeps it, clamped into the same box the
 *   automatic layout is clamped to. A position outside it could not be dragged
 *   back, because it would not be on screen.
 * - A pattern added since gets seeded **near its prerequisites**, not from a
 *   global re-layout. Re-running the layout would be correct and would also
 *   throw away everything the user arranged, every time they add a pattern.
 * - A stored entry whose pattern is gone is stale and reported for pruning.
 *
 * `autoLayout` is the fallback for a list with nothing stored at all, which
 * must behave exactly as it did before manual layouts existed.
 *
 * Stale entries are reported rather than silently kept. That used to be the
 * mitigation for recycled pattern ids (B14); ids no longer repeat, so it is
 * now just housekeeping — an entry for a pattern that is gone is dead weight.
 */
export function resolveLayout(
  patterns: IPattern[],
  stored: StoredGraphLayout | null,
  autoLayout: Map<number, LayoutPosition>,
): ResolvedLayout {
  const positions = new Map<number, LayoutPosition>();
  const seededIds: number[] = [];

  const storedPositions = stored?.positions ?? {};
  const liveIds = new Set(patterns.map((p) => p.id));

  const staleIds = Object.keys(storedPositions)
    .map((key) => Number(key))
    .filter((id) => Number.isInteger(id) && !liveIds.has(id));

  const unplaced: IPattern[] = [];
  for (const pattern of patterns) {
    const point = storedPositions[String(pattern.id)];
    if (isPoint(point)) {
      positions.set(pattern.id, {
        x: clampCoordinate(point.x),
        y: clampCoordinate(point.y),
      });
    } else {
      unplaced.push(pattern);
    }
  }

  // Nothing stored for this list: the automatic layout, untouched.
  if (positions.size === 0) {
    for (const pattern of patterns) {
      const auto = autoLayout.get(pattern.id);
      if (auto) positions.set(pattern.id, auto);
    }
    return { positions, staleIds, seededIds };
  }

  // Seed in prerequisite order where possible, so a chain of new patterns
  // hangs off the previous one rather than all landing on the same anchor.
  const adjacency = buildAdjacency(patterns);
  let remaining = unplaced;
  let index = 0;
  while (remaining.length > 0) {
    const deferred: IPattern[] = [];
    const before = positions.size;

    for (const pattern of remaining) {
      const prereqs = adjacency.prereqsOf.get(pattern.id) ?? [];
      const anchored = prereqs.some((id) => positions.has(id));
      if (!anchored && prereqs.length > 0) {
        deferred.push(pattern);
        continue;
      }
      const anchors = anchored
        ? prereqs
        : (adjacency.dependentsOf.get(pattern.id) ?? []);
      positions.set(
        pattern.id,
        seedPosition(pattern, anchors, positions, index++),
      );
      seededIds.push(pattern.id);
    }

    // No progress means every remaining pattern is waiting on another that is
    // also unplaced — a cycle, or a chain whose root is itself new. Place them
    // from whatever is on screen rather than looping.
    if (positions.size === before) {
      for (const pattern of deferred) {
        positions.set(
          pattern.id,
          seedPosition(pattern, [], positions, index++),
        );
        seededIds.push(pattern.id);
      }
      break;
    }
    remaining = deferred;
  }

  return { positions, staleIds, seededIds };
}

/** The positions to persist, with stale entries dropped. */
export function toStoredLayout(
  positions: Map<number, LayoutPosition>,
): StoredGraphLayout {
  const stored: Record<string, { x: number; y: number }> = {};
  for (const [id, position] of positions) {
    stored[String(id)] = {
      x: clampCoordinate(position.x),
      y: clampCoordinate(position.y),
    };
  }
  return {
    version: GRAPH_LAYOUT_VERSION,
    positions: stored,
    updatedAt: Date.now(),
  };
}
