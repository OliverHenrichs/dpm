import { BUILT_IN_LEVEL_IDS } from "@/src/pattern/types/PatternLevel";

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

const LIGHTEST = LEVEL_TINTS.beginner;
const DARKEST = LEVEL_TINTS.advanced;

/**
 * The tint of each of `count` levels, easiest first: spread from the lightest to the darkest, so
 * the contrast cap holds however many levels a list has. Three levels keep the built-in tints
 * exactly; a lone level takes the middle one, so it still differs from a figure without one.
 */
export function levelTints(count: number): number[] {
  if (count <= 0) return [];
  if (count === 1) return [LEVEL_TINTS.intermediate];
  if (count === 3) return [LIGHTEST, LEVEL_TINTS.intermediate, DARKEST];
  return Array.from(
    { length: count },
    (_, i) => LIGHTEST + ((DARKEST - LIGHTEST) * i) / (count - 1),
  );
}

/**
 * A figure's tint among its list's levels (`resolveLevelIds`). No level, or one the list does not
 * have, draws like the easiest level.
 */
export function levelTint(
  level: string | undefined,
  levelIds: readonly string[] = BUILT_IN_LEVEL_IDS,
): number {
  const index = level ? levelIds.indexOf(level) : -1;
  return index < 0 ? LIGHTEST : levelTints(levelIds.length)[index];
}

/** Where a foundational node's inner frame sits, inside the outline. */
export const FOUNDATIONAL_FRAME_INSET = 3;
