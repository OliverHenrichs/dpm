import { IPattern } from "@/src/pattern/types/IPatternList";
import { buildAdjacency } from "./adjacency";
import { GraphEdge, GraphModel, GraphNode } from "./GraphModel";
import { ChainMode, selectSubgraph } from "./selectSubgraph";

/**
 * The included ancestors nearest to an excluded node, walking back through
 * excluded nodes only.
 *
 * This is what turns "your prerequisite is hidden" into a drawable edge: the
 * chain A → B → C with B filtered out becomes an elided A → C rather than a
 * dropped edge that would make C look like a starting point.
 *
 * Memoised per excluded id, and visited-guarded, so a cycle among excluded
 * nodes terminates. The walk only ever traverses excluded nodes, so it costs
 * nothing once a filter is wide.
 */
function nearestIncludedAncestors(
  prereqsOf: Map<number, number[]>,
  included: Set<number>,
  cache: Map<number, number[]>,
  startId: number,
): number[] {
  const cached = cache.get(startId);
  if (cached) return cached;

  const found = new Set<number>();
  const seen = new Set<number>([startId]);
  const queue = [startId];

  while (queue.length > 0) {
    const id = queue.pop()!;
    for (const prereqId of prereqsOf.get(id) ?? []) {
      if (seen.has(prereqId)) continue;
      seen.add(prereqId);
      if (included.has(prereqId)) found.add(prereqId);
      else queue.push(prereqId);
    }
  }

  const result = [...found];
  cache.set(startId, result);
  return result;
}

/**
 * Narrow a model to the chains around a filter's matches.
 *
 * Two properties hold by construction, and both matter:
 *
 * 1. **Every node's `prerequisites` are a subset of the included ids.** The
 *    network layout places a node only once *every* prerequisite is already
 *    positioned, and `drawNodes` renders nothing for an unpositioned node — so
 *    an id pointing outside the subset makes that node and everything
 *    downstream of it vanish with no error. Handing the layout a shorter
 *    `patterns` array without rewriting its edges is exactly that bug.
 * 2. **Depth comes from the full graph.** Re-deriving it over the subset
 *    re-bases every timeline column, so toggling a filter would make patterns
 *    jump sideways. Gaps where hidden prerequisites were are the point: the
 *    filter reads as a highlight, not as a different diagram.
 *
 * `cycles` and `inCycle` also stay on full-graph terms — a cycle the filter
 * happens to hide is still corrupt data worth warning about.
 */
export function filterGraphModel(
  model: GraphModel,
  matchedIds: Set<number>,
  mode: ChainMode,
  maxDepth?: number,
): GraphModel {
  const { included, matched } = selectSubgraph(
    model.adjacency,
    matchedIds,
    mode,
    maxDepth,
  );

  const ancestorCache = new Map<number, number[]>();
  const edges: GraphEdge[] = [];
  const incoming = new Map<number, number[]>();

  for (const node of model.nodes) {
    const id = node.pattern.id;
    if (!included.has(id)) continue;

    const froms: number[] = [];
    const seenFrom = new Set<number>();
    const add = (from: number, kind: "direct" | "elided") => {
      if (from === id || seenFrom.has(from)) return;
      seenFrom.add(from);
      froms.push(from);
      edges.push({ from, to: id, kind });
    };

    for (const prereqId of model.adjacency.prereqsOf.get(id) ?? []) {
      if (included.has(prereqId)) add(prereqId, "direct");
    }
    // Elided edges go in a second pass on purpose: a hidden prerequisite can
    // elide onto an ancestor this node already has a direct edge from, and
    // `add` keeps whichever arrived first. Direct must win — drawing that
    // edge dashed would claim something is hidden along a path that is whole.
    for (const prereqId of model.adjacency.prereqsOf.get(id) ?? []) {
      if (included.has(prereqId)) continue;
      for (const ancestor of nearestIncludedAncestors(
        model.adjacency.prereqsOf,
        included,
        ancestorCache,
        prereqId,
      )) {
        add(ancestor, "elided");
      }
    }

    incoming.set(id, froms);
  }

  const nodes: GraphNode[] = [];
  const patterns: IPattern[] = [];

  for (const node of model.nodes) {
    const id = node.pattern.id;
    if (!included.has(id)) continue;

    const pattern: IPattern = {
      ...node.pattern,
      prerequisites: incoming.get(id) ?? [],
    };
    patterns.push(pattern);
    nodes.push({
      ...node,
      pattern,
      // Judged on what is drawn: a context node with no visible prerequisite
      // is a root of this view, and the layout anchors it as one.
      foundational: (incoming.get(id) ?? []).length === 0,
      isMatch: matched.has(id),
      isContext: !matched.has(id),
    });
  }

  return {
    nodes,
    edges,
    adjacency: buildAdjacency(patterns),
    depthMap: model.depthMap,
    cycles: model.cycles,
    typeColorMap: model.typeColorMap,
    patterns,
  };
}
