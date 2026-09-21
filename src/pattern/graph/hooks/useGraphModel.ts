import { useMemo } from "react";
import { IPattern } from "@/src/pattern/types/IPatternList";
import { PatternType } from "@/src/pattern/types/PatternType";
import {
  buildGraphModel,
  GraphModel,
} from "@/src/pattern/graph/model/GraphModel";

/**
 * Build the graph model once per (patterns, types) pair.
 *
 * Both graph views render from the same instance, so switching between them
 * costs nothing and they cannot disagree about depth, edges or cycles.
 */
export function useGraphModel(
  patterns: IPattern[],
  patternTypes: PatternType[],
): GraphModel {
  return useMemo(
    () => buildGraphModel(patterns, patternTypes),
    [patterns, patternTypes],
  );
}
