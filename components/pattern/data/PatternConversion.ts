import { WCSPattern } from "@/components/pattern/types/WCSPattern";
import { Pattern, PatternList } from "@/components/pattern/types/PatternList";
import { WCSPatternType } from "@/components/pattern/types/WCSPatternEnums";
import { createWestCoastSwingList } from "./DefaultPatternLists";

/**
 * Convert legacy WCS patterns to new Pattern format
 */
export function convertWCSPatternToPattern(
  wcsPattern: WCSPattern,
  typeIdMap: Map<WCSPatternType, string>,
): Pattern {
  return {
    id: wcsPattern.id,
    name: wcsPattern.name,
    typeId: typeIdMap.get(wcsPattern.type) || "",
    counts: wcsPattern.counts,
    level: wcsPattern.level,
    prerequisites: wcsPattern.prerequisites,
    description: wcsPattern.description,
    tags: wcsPattern.tags,
    videoRefs: wcsPattern.videoRefs,
  };
}

/**
 * Convert array of WCS patterns to new format using a WCS pattern list
 */
export function convertWCSPatternsToPatterns(
  wcsPatterns: WCSPattern[],
  wcsList: PatternList,
): Pattern[] {
  // Create type mapping from WCS enum to pattern type IDs
  const typeIdMap = new Map<WCSPatternType, string>();

  wcsList.patternTypes.forEach((type) => {
    // Match by slug
    if (type.slug === "push") {
      typeIdMap.set(WCSPatternType.PUSH, type.id);
    } else if (type.slug === "pass") {
      typeIdMap.set(WCSPatternType.PASS, type.id);
    } else if (type.slug === "whip") {
      typeIdMap.set(WCSPatternType.WHIP, type.id);
    } else if (type.slug === "tuck") {
      typeIdMap.set(WCSPatternType.TUCK, type.id);
    }
  });

  return wcsPatterns.map((wcsPattern) =>
    convertWCSPatternToPattern(wcsPattern, typeIdMap),
  );
}

/**
 * Get a temporary WCS pattern list for legacy pattern conversion
 */
export function getWCSPatternListForLegacyConversion(): PatternList {
  return createWestCoastSwingList();
}
