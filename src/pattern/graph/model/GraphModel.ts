import { IPattern } from "@/src/pattern/types/IPatternList";
import { PatternType } from "@/src/pattern/types/PatternType";
import {
  Adjacency,
  buildAdjacency,
  buildDepthMap,
  findCycles,
} from "./adjacency";

/** A pattern together with everything the views need to draw it. */
export interface GraphNode {
  pattern: IPattern;
  /** Longest chain from a prerequisite-free pattern. */
  depth: number;
  /** Nothing in this set is required before it. */
  foundational: boolean;
  /** Its type's colour, already resolved. */
  color?: string;
  /** True when the pattern sits in a prerequisite cycle. */
  inCycle: boolean;
  /** Matched the active filter directly. True throughout an unfiltered model. */
  isMatch: boolean;
  /** Drawn only because it is on a match's chain. Never true unfiltered. */
  isContext: boolean;
}

export interface GraphEdge {
  /** The prerequisite. */
  from: number;
  /** The pattern that requires it. */
  to: number;
  /**
   * `"elided"` means the real path runs through nodes a filter is hiding, so
   * the view can draw it differently rather than implying the chain is direct.
   * Always `"direct"` in an unfiltered model.
   */
  kind: "direct" | "elided";
}

export interface GraphModel {
  nodes: GraphNode[];
  edges: GraphEdge[];
  adjacency: Adjacency;
  depthMap: Map<number, number>;
  /** Groups of ids that can all reach each other. Empty for a healthy graph. */
  cycles: number[][];
  typeColorMap: Map<string, string>;
  /** Convenience: the same patterns the nodes wrap, in input order. */
  patterns: IPattern[];
}

/**
 * Everything the graph views need, computed once.
 *
 * The views used to each derive this for themselves — depth here, edges
 * there, cycle detection called on every render of one of them — and papered
 * over the gaps with `as any` because no type described what they were
 * passing around. Centralising it means the layout functions, the renderers
 * and (next) the filter all agree on one description of the graph.
 *
 * Pure and cheap: O(V + E). Memoise it on `(patterns, patternTypes)` at the
 * screen and hand the result down.
 */
export function buildGraphModel(
  patterns: IPattern[],
  patternTypes: PatternType[],
): GraphModel {
  const adjacency = buildAdjacency(patterns);
  const depthMap = buildDepthMap(adjacency);
  const cycles = findCycles(adjacency);

  const typeColorMap = new Map<string, string>();
  for (const type of patternTypes) typeColorMap.set(type.id, type.color);

  const cyclicIds = new Set(cycles.flat());

  const nodes: GraphNode[] = patterns.map((pattern) => ({
    pattern,
    depth: depthMap.get(pattern.id) ?? 0,
    // Judged on resolvable prerequisites: an id pointing at a pattern that is
    // not here does not make this one depend on anything drawable.
    foundational: (adjacency.prereqsOf.get(pattern.id) ?? []).length === 0,
    color: typeColorMap.get(pattern.typeId),
    inCycle: cyclicIds.has(pattern.id),
    isMatch: true,
    isContext: false,
  }));

  const edges: GraphEdge[] = [];
  for (const id of adjacency.ids) {
    for (const prereqId of adjacency.prereqsOf.get(id) ?? []) {
      edges.push({ from: prereqId, to: id, kind: "direct" });
    }
  }

  return {
    nodes,
    edges,
    adjacency,
    depthMap,
    cycles,
    typeColorMap,
    patterns,
  };
}

/** An empty model, for screens with no active list. */
export function emptyGraphModel(): GraphModel {
  return buildGraphModel([], []);
}
