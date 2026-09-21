import { Adjacency } from "./adjacency";

/**
 * How much of a match's chain to pull in alongside it.
 *
 * `prerequisites` answers "what do I need before I can do this?" and is the
 * dominant use case; `dependents` answers "where does this lead?".
 */
export type ChainMode =
  "matchesOnly" | "prerequisites" | "dependents" | "fullChain";

export interface SubgraphSelection {
  /** Every id to draw: the matches plus whatever context they pulled in. */
  included: Set<number>;
  /** The subset of `included` that matched the filter directly. */
  matched: Set<number>;
}

/** Which way each mode walks. `prerequisites` points backwards, so does the walk. */
const DIRECTIONS: Record<ChainMode, ("prereqsOf" | "dependentsOf")[]> = {
  matchesOnly: [],
  prerequisites: ["prereqsOf"],
  dependents: ["dependentsOf"],
  fullChain: ["prereqsOf", "dependentsOf"],
};

/**
 * Multi-source breadth-first walk from every seed at once.
 *
 * Seeding `seen` with all the matches is what makes this a single BFS rather
 * than one per match: a match reached from another match is already included
 * and is already a source, so it is never re-expanded. That also makes the
 * walk cycle-safe by construction.
 *
 * `maxDepth` counts steps away from the nearest match, not from any one match.
 */
function walk(
  adjacency: Adjacency,
  seeds: Set<number>,
  direction: "prereqsOf" | "dependentsOf",
  maxDepth: number | undefined,
  into: Set<number>,
): void {
  const seen = new Set(seeds);
  let frontier = [...seeds];
  let depth = 0;

  while (frontier.length > 0 && (maxDepth === undefined || depth < maxDepth)) {
    const next: number[] = [];
    for (const id of frontier) {
      for (const neighbour of adjacency[direction].get(id) ?? []) {
        if (seen.has(neighbour)) continue;
        seen.add(neighbour);
        into.add(neighbour);
        next.push(neighbour);
      }
    }
    frontier = next;
    depth++;
  }
}

/**
 * The ids to draw for a filter: the matches, plus their chains.
 *
 * O(V + E) — a breadth-first walk over the adjacency index, deliberately not
 * a path enumeration. Ids in `matchedIds` that are not in the graph are
 * ignored, so a caller may pass a match set computed against a stale pattern
 * array without losing the rest of the selection.
 *
 * This decides *which* nodes appear. It does not rewrite any edges — see
 * `filterGraphModel`, which must run afterwards, because handing the layout a
 * node whose prerequisites point outside `included` makes it silently
 * unplaceable.
 */
export function selectSubgraph(
  adjacency: Adjacency,
  matchedIds: Set<number>,
  mode: ChainMode,
  maxDepth?: number,
): SubgraphSelection {
  const matched = new Set<number>();
  for (const id of matchedIds) {
    if (adjacency.prereqsOf.has(id)) matched.add(id);
  }

  const included = new Set(matched);
  if (maxDepth !== undefined && maxDepth <= 0) return { included, matched };

  for (const direction of DIRECTIONS[mode]) {
    walk(adjacency, matched, direction, maxDepth, included);
  }

  return { included, matched };
}
