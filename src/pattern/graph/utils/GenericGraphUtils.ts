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
 * Every pattern that transitively depends on `rootId` — i.e. everything
 * reachable by walking *forwards* along prerequisite edges, since
 * `prerequisites` points backwards from a pattern to what must be learned
 * first.
 *
 * Breadth-first over an index built once, so it is O(V + E) and cycle-safe:
 * the visited set stops a cycle from looping forever. `rootId` itself is
 * included only when something genuinely leads back to it.
 */
export function collectDependentIds<T extends PatternLike>(
  patterns: T[],
  rootId: number,
): Set<number> {
  const dependentsOf = new Map<number, number[]>();
  for (const pattern of patterns) {
    for (const prereqId of pattern.prerequisites) {
      const existing = dependentsOf.get(prereqId);
      if (existing) existing.push(pattern.id);
      else dependentsOf.set(prereqId, [pattern.id]);
    }
  }

  const dependents = new Set<number>();
  const queue = [...(dependentsOf.get(rootId) ?? [])];
  while (queue.length > 0) {
    const id = queue.pop()!;
    if (dependents.has(id)) continue;
    dependents.add(id);
    queue.push(...(dependentsOf.get(id) ?? []));
  }
  return dependents;
}

/**
 * The patterns that may not be used as a prerequisite of `patternId` because
 * doing so would close a cycle: the pattern itself, plus everything that
 * already depends on it.
 *
 * Pass `undefined` for a pattern that does not exist yet — nothing can depend
 * on it, so everything is eligible.
 */
export function findIneligiblePrerequisiteIds<T extends PatternLike>(
  patterns: T[],
  patternId: number | undefined,
): Set<number> {
  if (patternId === undefined) return new Set<number>();
  const ineligible = collectDependentIds(patterns, patternId);
  ineligible.add(patternId);
  return ineligible;
}

/**
 * Drop prerequisite ids that do not match any pattern in the set.
 *
 * Deleting a pattern used to leave its id behind in every pattern that
 * required it. A dangling id is not merely cosmetic: the network layout only
 * places a node once *all* of its prerequisites are positioned, so such a node
 * — and everything downstream of it — silently disappeared from the graph.
 * Returns the same array when there is nothing to repair, so callers can skip
 * a needless write.
 */
export function repairDanglingPrerequisites<T extends PatternLike & object>(
  patterns: T[],
): T[] {
  const known = new Set(patterns.map((pattern) => pattern.id));
  let changed = false;

  const repaired = patterns.map((pattern) => {
    const kept = pattern.prerequisites.filter((id) => known.has(id));
    if (kept.length === pattern.prerequisites.length) return pattern;
    changed = true;
    return { ...pattern, prerequisites: kept };
  });

  return changed ? repaired : patterns;
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
