import { useMemo } from "react";
import { IPattern } from "@/src/pattern/types/IPatternList";
import { SortConfig } from "@/src/pattern/list/SortBottomSheet";

export function usePatternSort(patterns: IPattern[], sortConfig: SortConfig) {
  const sortedPatterns = useMemo(() => {
    return [...patterns].sort((pattern, otherPattern) => {
      let aValue: string | number | undefined = pattern[sortConfig.field];
      let bValue: string | number | undefined = otherPattern[sortConfig.field];

      // Handle undefined/null values
      if (aValue === undefined || aValue === null) return 1;
      if (bValue === undefined || bValue === null) return -1;

      // Convert to comparable values
      if (typeof aValue === "string" && typeof bValue === "string") {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      return sortConfig.order === "asc" ? comparison : -comparison;
    });
  }, [patterns, sortConfig]);

  return { sortedPatterns };
}
