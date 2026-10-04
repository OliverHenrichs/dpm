import {
  alpha,
  APP_STYLES,
  buildTheme,
  ColorTokens,
  palettes,
  webFonts,
} from "@/src/common/theme/tokens";
import { contrast, prefersDarkText } from "@/src/common/theme/contrast";

type C = keyof ColorTokens;

/** Body text: WCAG AA 1.4.3. */
const TEXT = 4.5;
/** Control boundaries and meaningful icons: WCAG AA 1.4.11. */
const NON_TEXT = 3;

const BACKDROPS: C[] = ["background", "surface", "surfaceVariant"];

/** [foreground, background, minimum ratio] — every pairing the roles promise. */
const PAIRS: [C, C, number][] = [
  ...BACKDROPS.flatMap((bg): [C, C, number][] => [
    ["text", bg, TEXT],
    ["textMuted", bg, TEXT],
    ["primary", bg, TEXT],
    ["danger", bg, TEXT],
  ]),
  ["onPrimary", "primary", TEXT],
  ["onDanger", "danger", TEXT],
  ["onSurfaceVariant", "surfaceVariant", TEXT],
  ["onSurfaceVariant", "surface", TEXT],
  // Success is for icons and short labels on the page, not inside inputs.
  ["success", "background", TEXT],
  ["success", "surface", TEXT],
  // An input's outline is judged against what surrounds it, not its own fill.
  ["borderStrong", "surface", NON_TEXT],
  ["borderStrong", "background", NON_TEXT],
  // Secondary buttons are filled with Border.
  ["text", "border", TEXT],
];

const PALETTES = APP_STYLES.flatMap((style) =>
  (["light", "dark"] as const).map((scheme): [string, ColorTokens] => [
    `${style} ${scheme}`,
    palettes[style][scheme],
  ]),
);

describe.each(PALETTES)("%s colours", (_, palette) => {
  it.each(PAIRS)("%s on %s reaches %s:1", (fg, bg, min) => {
    expect(contrast(palette[fg], palette[bg])).toBeGreaterThanOrEqual(min);
  });

  it("uses 6-digit hex for every solid colour, so a hex alpha can be appended", () => {
    for (const role of Object.keys(palette) as C[]) {
      if (role === "overlay") continue;
      expect(palette[role]).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

describe("styles", () => {
  it.each(APP_STYLES)("%s resolves every text style to a family", (style) => {
    const theme = buildTheme(style, "light", webFonts[style]);
    for (const text of Object.values(theme.typography)) {
      expect(text.fontFamily).toBeTruthy();
      expect(text.fontSize).toBeGreaterThan(0);
    }
  });

  it("gives both styles the same token names, so no component has to ask which is on", () => {
    const [a, b] = APP_STYLES.map((style) => buildTheme(style, "dark"));
    expect(Object.keys(b.typography).sort()).toEqual(
      Object.keys(a.typography).sort(),
    );
    expect(Object.keys(b.radius).sort()).toEqual(Object.keys(a.radius).sort());
    expect(Object.keys(b.list).sort()).toEqual(Object.keys(a.list).sort());
  });
});

describe("prefersDarkText", () => {
  it("picks the text colour that contrasts more with a type colour", () => {
    expect(prefersDarkText("#ffd700")).toBe(true);
    expect(prefersDarkText("#4b3aa6")).toBe(false);
  });

  it("falls back to white for a colour it cannot read", () => {
    expect(prefersDarkText("tomato")).toBe(false);
  });
});

describe("alpha", () => {
  it("appends the opacity as a hex byte", () => {
    expect(alpha("#4f46e5", 0)).toBe("#4f46e500");
    expect(alpha("#4f46e5", 0.12)).toBe("#4f46e51f");
    expect(alpha("#4f46e5", 1)).toBe("#4f46e5ff");
  });
});
