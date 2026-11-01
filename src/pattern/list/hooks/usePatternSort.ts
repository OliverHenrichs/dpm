import { useMemo } from "react";
import { IPattern } from "@/src/pattern/types/IPatternList";
import { PatternType } from "@/src/pattern/types/PatternType";
import { SortConfig } from "@/src/pattern/list/SortBottomSheet";
import { sortPatterns } from "./patternSections";

/** The list in sort order; see `patternSections.ts` for how each field ranks. */
export function usePatternSort(
  patterns: IPattern[],
  sortConfig: SortConfig,
  patternTypes?: PatternType[],
  /** The list's levels in their order (`resolveLevelIds`); left out, the built-in three. */
  levelIds?: readonly string[],
) {
  const sortedPatterns = useMemo(
    () => sortPatterns(patterns, sortConfig, patternTypes, levelIds),
    [patterns, sortConfig, patternTypes, levelIds],
  );

  return { sortedPatterns };
}
