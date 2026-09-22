import { IPattern } from "@/src/pattern/types/IPatternList";

/** What a node should advertise about itself, beyond its name and counts. */
export interface NodeBadges {
  /**
   * The pattern has video somewhere — its own, or of one of its modifier
   * combinations. Both are "there is something to watch here" as far as
   * someone scanning the graph is concerned.
   */
  hasVideo: boolean;
  /**
   * How many modifiers are attached to this pattern.
   *
   * `modifierRefs` holds only non-universal attachments by definition
   * (`IPatternList.ts`), which is what makes this worth showing: a universal
   * modifier applies to every pattern, so badging it would put the same mark
   * on every node and say nothing.
   */
  modifierCount: number;
}

/**
 * What to draw on a node, as a pure function of the pattern.
 *
 * Kept out of the renderer so it can be tested without an SVG: the
 * interesting part is which things count as "has video", not where the glyph
 * lands. Cheap enough to call per node per render — it reads two array
 * lengths — so it is not precomputed into `GraphModel`, which would mean
 * threading it through every layout function that passes nodes around.
 */
export function nodeBadges(pattern: IPattern): NodeBadges {
  const modifierRefs = pattern.modifierRefs ?? [];
  return {
    hasVideo:
      (pattern.videoRefs ?? []).length > 0 ||
      modifierRefs.some((ref) => (ref.videoRefs ?? []).length > 0),
    modifierCount: modifierRefs.length,
  };
}
