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
) {
  const sortedPatterns = useMemo(
    () => sortPatterns(patterns, sortConfig, patternTypes),
    [patterns, sortConfig, patternTypes],
  );

  return { sortedPatterns };
}
