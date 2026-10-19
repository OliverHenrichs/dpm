import { PatternLevel } from "@/src/pattern/types/PatternLevel";

/**
 * How much of the type colour is laid over the box's surface, by level, so level reads at a
 * glance. Kept low enough that the node's text holds 4.5:1 over every palette type colour in
 * every theme (`__tests__/unit/nodeFrame.test.ts`).
 *
 * It used to be the *text* colour at 0.3 / 0.5 / 0.7, which drew a box in a grey of its own
 * that neither style asked for.
 */
export const LEVEL_TINTS = {
  beginner: 0.1,
  intermediate: 0.22,
  advanced: 0.36,
} as const;

export function levelTint(level: string | undefined): number {
  switch (level) {
    case PatternLevel.INTERMEDIATE:
    case "intermediate":
      return LEVEL_TINTS.intermediate;
    case PatternLevel.ADVANCED:
    case "advanced":
      return LEVEL_TINTS.advanced;
    default:
      return LEVEL_TINTS.beginner;
  }
}

/** Where a foundational node's inner frame sits, inside the outline. */
export const FOUNDATIONAL_FRAME_INSET = 3;
