import { APP_STYLES, mix, palettes } from "@/src/common/theme/tokens";
import { contrast } from "@/src/common/theme/contrast";
import { PATTERN_TYPE_COLORS } from "@/src/pattern/types/PatternType";
import { LEVEL_TINTS, levelTint } from "@/src/pattern/graph/model/nodeFrame";
import { PatternLevel } from "@/src/pattern/types/PatternLevel";

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
