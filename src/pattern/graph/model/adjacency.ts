/** The minimum a node needs to take part in the graph. */
export interface PatternLike {
  id: number;
  prerequisites: number[];
}

export interface Adjacency {
  /** id → the ids it requires. Only ids that exist in the set. */
  prereqsOf: Map<number, number[]>;
  /** id → the ids that require it. */
  dependentsOf: Map<number, number[]>;
  /** Every id in the set, in input order. */
  ids: number[];
}

/**
 * Index the graph once, in both directions.
 *
 * Everything else in the model walks this instead of re-scanning the pattern
 * array — which is what turns the old path-enumerating helpers into O(V + E).
 * Prerequisite ids that match no pattern are dropped here, so no consumer has
 * to guard against them.
 */
export function buildAdjacency<T extends PatternLike>(
  patterns: T[],
): Adjacency {
  const ids = patterns.map((p) => p.id);
  const known = new Set(ids);
  const prereqsOf = new Map<number, number[]>();
  const dependentsOf = new Map<number, number[]>();

  for (const id of ids) {
    prereqsOf.set(id, []);
    dependentsOf.set(id, []);
  }

  for (const pattern of patterns) {
    for (const prereqId of pattern.prerequisites) {
      if (!known.has(prereqId)) continue;
      prereqsOf.get(pattern.id)!.push(prereqId);
      dependentsOf.get(prereqId)!.push(pattern.id);
    }
  }

  return { prereqsOf, dependentsOf, ids };
}

/**
 * Every id that transitively depends on `rootId` — everything reachable by
 * walking forwards, since `prerequisites` points backwards.
 *
 * Breadth-first and cycle-safe. `rootId` appears in the result only when
 * something genuinely leads back to it.
 */
export function collectDependents(
  adjacency: Adjacency,
  rootId: number,
): Set<number> {
  const found = new Set<number>();
  const queue = [...(adjacency.dependentsOf.get(rootId) ?? [])];
  while (queue.length > 0) {
    const id = queue.pop()!;
    if (found.has(id)) continue;
    found.add(id);
    queue.push(...(adjacency.dependentsOf.get(id) ?? []));
  }
  return found;
}

/** Every id `startId` transitively requires. */
export function collectPrerequisites(
  adjacency: Adjacency,
  startId: number,
): Set<number> {
  const found = new Set<number>();
  const queue = [...(adjacency.prereqsOf.get(startId) ?? [])];
  while (queue.length > 0) {
    const id = queue.pop()!;
    if (found.has(id)) continue;
    found.add(id);
    queue.push(...(adjacency.prereqsOf.get(id) ?? []));
  }
  return found;
}

/**
 * Prerequisite cycles, as groups of ids that can all reach each other.
 *
 * Iterative Tarjan: O(V + E), and iterative rather than recursive so a long
 * chain cannot blow the stack. It replaces a detector that enumerated every
 * distinct path — copying the visited set and the path array per edge — which
 * is exponential in the number of paths on a densely linked list and whose
 * only output was a `console.warn`.
 *
 * A self-prerequisite counts as a cycle of one; otherwise only components of
 * two or more are cycles.
 */
export function findCycles(adjacency: Adjacency): number[][] {
  const index = new Map<number, number>();
  const lowlink = new Map<number, number>();
  const onStack = new Set<number>();
  const stack: number[] = [];
  const cycles: number[][] = [];
  let nextIndex = 0;

  for (const root of adjacency.ids) {
    if (index.has(root)) continue;

    // Each frame remembers how far through its successors it has walked.
    const frames: { id: number; next: number }[] = [{ id: root, next: 0 }];
    index.set(root, nextIndex);
    lowlink.set(root, nextIndex);
    nextIndex++;
    stack.push(root);
    onStack.add(root);

    while (frames.length > 0) {
      const frame = frames[frames.length - 1];
      const successors = adjacency.prereqsOf.get(frame.id) ?? [];

      if (frame.next < successors.length) {
        const successor = successors[frame.next++];
        if (!index.has(successor)) {
          index.set(successor, nextIndex);
          lowlink.set(successor, nextIndex);
          nextIndex++;
          stack.push(successor);
          onStack.add(successor);
          frames.push({ id: successor, next: 0 });
        } else if (onStack.has(successor)) {
          lowlink.set(
            frame.id,
            Math.min(lowlink.get(frame.id)!, index.get(successor)!),
          );
        }
        continue;
      }

      frames.pop();
      const parent = frames[frames.length - 1];
      if (parent) {
        lowlink.set(
          parent.id,
          Math.min(lowlink.get(parent.id)!, lowlink.get(frame.id)!),
        );
      }

      if (lowlink.get(frame.id) === index.get(frame.id)) {
        const component: number[] = [];
        let member: number;
        do {
          member = stack.pop()!;
          onStack.delete(member);
          component.push(member);
        } while (member !== frame.id);

        const isSelfCycle =
          component.length === 1 &&
          (adjacency.prereqsOf.get(component[0]) ?? []).includes(component[0]);
        if (component.length > 1 || isSelfCycle) {
          cycles.push(component.reverse());
        }
      }
    }
  }

  return cycles;
}

/**
 * Longest chain from a pattern with no prerequisites, per id.
 *
 * Iterative depth-first with memoisation, so a node is visited once. A node
 * inside a cycle has no well-defined depth; it gets the depth it can be
 * reached at, which keeps the timeline laying it out somewhere sensible
 * instead of dropping it.
 */
export function buildDepthMap(adjacency: Adjacency): Map<number, number> {
  const depth = new Map<number, number>();
  const inProgress = new Set<number>();

  for (const root of adjacency.ids) {
    if (depth.has(root)) continue;

    const frames: { id: number; next: number; best: number }[] = [
      { id: root, next: 0, best: 0 },
    ];
    inProgress.add(root);

    while (frames.length > 0) {
      const frame = frames[frames.length - 1];
      const prereqs = adjacency.prereqsOf.get(frame.id) ?? [];

      if (frame.next < prereqs.length) {
        const prereqId = prereqs[frame.next++];
        if (depth.has(prereqId)) {
          frame.best = Math.max(frame.best, depth.get(prereqId)! + 1);
        } else if (!inProgress.has(prereqId)) {
          inProgress.add(prereqId);
          frames.push({ id: prereqId, next: 0, best: 0 });
        }
        // A prerequisite already in progress closes a cycle; skip it rather
        // than recursing forever.
        continue;
      }

      frames.pop();
      inProgress.delete(frame.id);
      depth.set(frame.id, frame.best);
      const parent = frames[frames.length - 1];
      if (parent) {
        parent.best = Math.max(parent.best, frame.best + 1);
      }
    }
  }

  return depth;
}
