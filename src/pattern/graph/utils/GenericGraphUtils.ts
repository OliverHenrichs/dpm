import {
  buildAdjacency,
  collectDependents,
  PatternLike,
} from "@/src/pattern/graph/model/adjacency";

/**
 * Prerequisite integrity helpers used outside the graph views.
 *
 * The graph itself works from `GraphModel`; these two exist because the
 * pattern editor and the storage layer need the same reasoning without
 * building a whole model. Both delegate to the model's adjacency index rather
 * than walking the pattern array themselves.
 *
 * What used to live here as well — a cycle detector that enumerated every
 * distinct path, and a recursive depth calculation — is gone. `findCycles` and
 * `buildDepthMap` in `model/adjacency.ts` replace them: O(V + E), iterative,
 * and computed once per model instead of per render.
 */

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
  const ineligible = collectDependents(buildAdjacency(patterns), patternId);
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
