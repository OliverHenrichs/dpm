import { useCallback, useEffect, useMemo, useState } from "react";
import { IPattern } from "@/src/pattern/types/IPatternList";
import { LayoutPosition } from "@/src/pattern/graph/utils/GraphUtils";
import {
  clearGraphLayout,
  loadGraphLayout,
  saveGraphLayout,
} from "@/src/pattern/graph/data/GraphLayoutStorage";
import {
  resolveLayout,
  StoredGraphLayout,
  toStoredLayout,
} from "@/src/pattern/graph/model/resolveLayout";

export interface GraphPositions {
  positions: Map<number, LayoutPosition>;
  /** True once a manual position exists, which is what enables "reset". */
  hasManualLayout: boolean;
  /** Persist one node's new position. */
  moveNode: (id: number, position: LayoutPosition) => void;
  /** Forget the manual layout and go back to the automatic one. */
  resetLayout: () => Promise<void>;
}

/**
 * The positions to draw, merging a stored manual layout over the automatic one.
 *
 * `allPatterns` is deliberately the *unfiltered* set. `resolveLayout` reports
 * a stored id it cannot see as stale, and a filter hides patterns rather than
 * deleting them — pruning against the filtered set would throw away the user's
 * arrangement the moment they searched for something.
 */
export function useGraphPositions(
  listId: string | undefined,
  allPatterns: IPattern[],
  autoLayout: Map<number, LayoutPosition>,
): GraphPositions {
  // One piece of state, not two: they are only ever meaningful together, and
  // setting them separately is what makes an effect cascade renders.
  const [loaded, setLoaded] = useState<{
    listId: string | undefined;
    layout: StoredGraphLayout | null;
  }>({ listId: undefined, layout: null });

  // Switching lists is adjusted during render rather than in an effect, so
  // nothing downstream ever sees another list's arrangement.
  const [lastListId, setLastListId] = useState(listId);
  if (lastListId !== listId) {
    setLastListId(listId);
    setLoaded({ listId: undefined, layout: null });
  }

  useEffect(() => {
    if (!listId) return;
    let cancelled = false;
    void loadGraphLayout(listId).then((layout) => {
      if (!cancelled) setLoaded({ listId, layout });
    });
    return () => {
      cancelled = true;
    };
  }, [listId]);

  const stored = loaded.listId === listId ? loaded.layout : null;
  const setStored = useCallback(
    (layout: StoredGraphLayout | null) => setLoaded({ listId, layout }),
    [listId],
  );

  const resolved = useMemo(
    // Until the stored layout has loaded, `stored` is null and this is the
    // automatic layout — which is also the right answer for a list that has
    // never been arranged, so there is nothing to show in the meantime.
    () => resolveLayout(allPatterns, stored, autoLayout),
    [allPatterns, stored, autoLayout],
  );

  const moveNode = useCallback(
    (id: number, position: LayoutPosition) => {
      if (!listId) return;
      // Built from the resolved positions, so seeded nodes are persisted too
      // and stale entries are dropped — this is where the pruning happens.
      const next = new Map(resolved.positions);
      next.set(id, position);
      const layout = toStoredLayout(next);
      setStored(layout);
      void saveGraphLayout(listId, layout);
    },
    [listId, resolved.positions],
  );

  const resetLayout = useCallback(async () => {
    if (!listId) return;
    await clearGraphLayout(listId);
    setStored(null);
  }, [listId]);

  return {
    positions: resolved.positions,
    hasManualLayout: stored !== null,
    moveNode,
    resetLayout,
  };
}
