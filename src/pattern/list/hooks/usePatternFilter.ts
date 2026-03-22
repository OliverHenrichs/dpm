import { useMemo } from "react";
import { IPattern } from "@/src/pattern/types/IPatternList";
import { PatternFilter } from "@/src/pattern/filter/components/PatternFilterBottomSheet";

export function usePatternFilter(patterns: IPattern[], filter: PatternFilter) {
  const filteredPatterns = useMemo(() => {
    return patterns.filter((pattern) => {
      // Name filter
      if (
        filter.name &&
        !pattern.name.toLowerCase().includes(filter.name.toLowerCase())
      ) {
        return false;
      }

      // Type filter - use typeId
      if (filter.types.length > 0) {
        if (!filter.types.includes(pattern.typeId)) {
          return false;
        }
      }

      // Level filter
      if (
        filter.levels.length > 0 &&
        (!pattern.level || !filter.levels.includes(pattern.level as any))
      ) {
        return false;
      }

      // Counts filter
      if (filter.counts !== undefined && pattern.counts !== filter.counts) {
        return false;
      }

      // Tags filter - pattern must have ALL selected tags
      if (filter.tags.length > 0) {
        const hasAllTags = filter.tags.every((tag) =>
          pattern.tags.some(
            (patternTag) => patternTag.toLowerCase() === tag.toLowerCase(),
          ),
        );
        if (!hasAllTags) {
          return false;
        }
      }

      return true;
    });
  }, [patterns, filter]);

  const hasActiveFilter = useMemo(() => {
    return (
      filter.name !== "" ||
      filter.types.length > 0 ||
      filter.levels.length > 0 ||
      filter.counts !== undefined ||
      filter.tags.length > 0
    );
  }, [filter]);

  return { filteredPatterns, hasActiveFilter };
}
