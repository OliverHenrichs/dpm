import { useMemo } from "react";
import { IPattern } from "@/src/pattern/types/IPatternList";
import { PatternFilter } from "@/src/pattern/filter/components/PatternFilterBottomSheet";

/**
 * Apply a `PatternFilter` to a pattern array.
 *
 * Lives beside the filter it implements rather than under `list/`: the graph
 * screen filters too, and nothing in here was ever list-specific.
 */
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

      // Level filter. `IPattern.level` is a bare string — older lists carry
      // values that are not in the enum — so compare as strings rather than
      // casting one side into the other.
      if (
        filter.levels.length > 0 &&
        (!pattern.level ||
          !filter.levels.some((level) => level === pattern.level))
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
