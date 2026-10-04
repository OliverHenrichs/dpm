import { FONT_FAMILIES } from "@/app.config";
import { APP_STYLES, buildTheme } from "@/src/common/theme/tokens";

/**
 * Every text style must name a family and weight that a shipped file provides. Android fakes a
 * missing weight (a smeared bold) or silently falls back to the system font, and neither shows
 * up anywhere but on a device.
 */
describe.each(APP_STYLES)("%s type scale", (style) => {
  const theme = buildTheme(style, "light");

  it.each(Object.entries(theme.typography))(
    "%s is set in a shipped file",
    (_, text) => {
      const family = FONT_FAMILIES.find((f) => f.family === text.fontFamily);
      expect(family).toBeDefined();
      const italic = text.fontStyle === "italic";
      expect(
        family!.files.some(
          (file) =>
            file.weight === Number(text.fontWeight ?? 400) &&
            (file.style === "italic") === italic,
        ),
      ).toBe(true);
    },
  );
});
