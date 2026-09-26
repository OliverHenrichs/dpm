import {
  alpha,
  ColorTokens,
  darkColors,
  lightColors,
} from "@/src/common/theme/tokens";

type C = keyof ColorTokens;

/** WCAG 2.x relative luminance of a `#rrggbb` colour. */
function luminance(hex: string): number {
  const channels = [1, 3, 5].map(
    (i) => parseInt(hex.slice(i, i + 2), 16) / 255,
  );
  const [r, g, b] = channels.map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

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

describe.each([
  ["light", lightColors],
  ["dark", darkColors],
] as [string, ColorTokens][])("%s colours", (_, palette) => {
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

describe("alpha", () => {
  it("appends the opacity as a hex byte", () => {
    expect(alpha("#4f46e5", 0)).toBe("#4f46e500");
    expect(alpha("#4f46e5", 0.12)).toBe("#4f46e51f");
    expect(alpha("#4f46e5", 1)).toBe("#4f46e5ff");
  });
});
