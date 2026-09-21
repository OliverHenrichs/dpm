import { useCallback, useMemo, useState } from "react";
import { IPattern } from "@/src/pattern/types/IPatternList";
import { PatternType } from "@/src/pattern/types/PatternType";
import { PatternFilter } from "@/src/pattern/filter/components/PatternFilterBottomSheet";
import { usePatternFilter } from "@/src/pattern/filter/hooks/usePatternFilter";
import { GraphModel } from "@/src/pattern/graph/model/GraphModel";
import { filterGraphModel } from "@/src/pattern/graph/model/filterGraphModel";
import { ChainMode } from "@/src/pattern/graph/model/selectSubgraph";
import { DEFAULT_CHAIN_MODE } from "@/src/pattern/graph/types/ChainMode";
import { useGraphModel } from "@/src/pattern/graph/hooks/useGraphModel";

export const EMPTY_FILTER: PatternFilter = {
  name: "",
  types: [],
  levels: [],
  counts: undefined,
  tags: [],
};

export interface GraphFilterState {
  /** The model to render: narrowed when a filter is active, else the full one. */
  model: GraphModel;
  /** The unnarrowed model, for counts and for the "everything" comparison. */
  fullModel: GraphModel;
  filter: PatternFilter;
  setFilter: (filter: PatternFilter) => void;
  chainMode: ChainMode;
  setChainMode: (mode: ChainMode) => void;
  hasActiveFilter: boolean;
  matchedCount: number;
  shownCount: number;
  totalCount: number;
  clearFilter: () => void;
}

/**
 * Filter state for the graph screen, and the model that follows from it.
 *
 * Deliberately not persisted. A filter that survives a navigation away is
 * invisible on return and reads as "my patterns disappeared".
 */
export function useGraphFilter(
  patterns: IPattern[],
  patternTypes: PatternType[],
  activeListId: string | undefined,
): GraphFilterState {
  const [filter, setFilter] = useState<PatternFilter>(EMPTY_FILTER);
  const [chainMode, setChainMode] = useState<ChainMode>(DEFAULT_CHAIN_MODE);

  const clearFilter = useCallback(() => setFilter(EMPTY_FILTER), []);

  // A filter written against one list means nothing in another. Adjusted
  // during render rather than in an effect: React re-runs this component
  // before committing, so nothing downstream ever sees the stale filter, and
  // an effect here would set state synchronously and cascade a second render.
  const [lastListId, setLastListId] = useState(activeListId);
  if (lastListId !== activeListId) {
    setLastListId(activeListId);
    setFilter(EMPTY_FILTER);
  }

  const fullModel = useGraphModel(patterns, patternTypes);
  const { filteredPatterns, hasActiveFilter } = usePatternFilter(
    patterns,
    filter,
  );

  const model = useMemo(() => {
    // Nothing to narrow, and this is the common case while the sheet is
    // closed — skip the selection pass and the model rebuild entirely.
    if (!hasActiveFilter) return fullModel;
    if (filteredPatterns.length === patterns.length) return fullModel;

    return filterGraphModel(
      fullModel,
      new Set(filteredPatterns.map((p) => p.id)),
      chainMode,
    );
  }, [
    fullModel,
    filteredPatterns,
    patterns.length,
    hasActiveFilter,
    chainMode,
  ]);

  return {
    model,
    fullModel,
    filter,
    setFilter,
    chainMode,
    setChainMode,
    hasActiveFilter,
    matchedCount: filteredPatterns.length,
    shownCount: model.nodes.length,
    totalCount: patterns.length,
    clearFilter,
  };
}
