import { APP_STYLES, mix, palettes } from "@/src/common/theme/tokens";
import { contrast } from "@/src/common/theme/contrast";
import { PATTERN_TYPE_COLORS } from "@/src/pattern/types/PatternType";
import {
  LEVEL_TINTS,
  levelTint,
  levelTints,
} from "@/src/pattern/graph/model/nodeFrame";
import { MAX_LEVELS, PatternLevel } from "@/src/pattern/types/PatternLevel";

/**
 * A Map box is the surface with some of the pattern type's colour mixed in, more the harder
 * the pattern. Its name and counts sit on that fill, so the tint is capped by what the text
 * can take over every colour a type can be given.
 */
describe.each(
  APP_STYLES.flatMap((style) =>
    (["light", "dark"] as const).map((scheme) => [style, scheme] as const),
  ),
)("%s %s pattern boxes", (style, scheme) => {
  const palette = palettes[style][scheme];

  it.each(Object.entries(LEVEL_TINTS))(
    "keep the text at 4.5:1 over a %s tint of every type colour",
    (_, tint) => {
      for (const color of Object.values(PATTERN_TYPE_COLORS)) {
        const fill = mix(palette.surface, color, tint);
        expect(contrast(palette.text, fill)).toBeGreaterThanOrEqual(4.5);
      }
    },
  );
});

describe("levelTint", () => {
  it("gets denser with the level", () => {
    expect(levelTint(PatternLevel.BEGINNER)).toBeLessThan(
      levelTint(PatternLevel.INTERMEDIATE),
    );
    expect(levelTint(PatternLevel.INTERMEDIATE)).toBeLessThan(
      levelTint(PatternLevel.ADVANCED),
    );
  });

  it("draws an unset level like a beginner one", () => {
    expect(levelTint(undefined)).toBe(LEVEL_TINTS.beginner);
  });
});

describe("levelTints", () => {
  it("keeps today's exact tints for three levels", () => {
    expect(levelTints(3)).toEqual([
      LEVEL_TINTS.beginner,
      LEVEL_TINTS.intermediate,
      LEVEL_TINTS.advanced,
    ]);
  });

  it.each([2, 4, 5, 8, MAX_LEVELS])(
    "spreads %i levels from the lightest to the darkest, getting denser",
    (count) => {
      const tints = levelTints(count);
      expect(tints).toHaveLength(count);
      expect(tints[0]).toBeCloseTo(LEVEL_TINTS.beginner);
      expect(tints[count - 1]).toBeCloseTo(LEVEL_TINTS.advanced);
      for (let i = 1; i < count; i++) {
        expect(tints[i]).toBeGreaterThan(tints[i - 1]);
      }
      // Within the range the contrast test above checks.
      for (const tint of tints) {
        expect(tint).toBeLessThanOrEqual(LEVEL_TINTS.advanced + 1e-9);
      }
    },
  );

  it("gives a lone level the middle tint, so it differs from no level", () => {
    expect(levelTints(1)).toEqual([LEVEL_TINTS.intermediate]);
    expect(levelTints(0)).toEqual([]);
  });
});

describe("levelTint among a list's own levels", () => {
  const course = ["c1", "c2", "c3", "c4", "c5"];

  it("shades by the level's place in the list", () => {
    expect(levelTint("c1", course)).toBeCloseTo(LEVEL_TINTS.beginner);
    expect(levelTint("c3", course)).toBeCloseTo(0.23);
    expect(levelTint("c5", course)).toBeCloseTo(LEVEL_TINTS.advanced);
  });

  it("draws a level the list does not have like no level", () => {
    expect(levelTint("advanced", course)).toBe(LEVEL_TINTS.beginner);
  });
});
