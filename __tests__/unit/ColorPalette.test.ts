import {
  DarkPalette,
  LightPalette,
  Palette,
  PaletteColor as C,
} from "@/src/common/utils/ColorPalette";

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

const BACKDROPS = [C.Background, C.Surface, C.SurfaceVariant] as const;

/** [foreground, background, minimum ratio] — every pairing the roles promise. */
const PAIRS: [C, C, number][] = [
  ...BACKDROPS.flatMap((bg): [C, C, number][] => [
    [C.Text, bg, TEXT],
    [C.TextMuted, bg, TEXT],
    [C.Primary, bg, TEXT],
    [C.Danger, bg, TEXT],
  ]),
  [C.OnPrimary, C.Primary, TEXT],
  [C.OnDanger, C.Danger, TEXT],
  [C.OnSurfaceVariant, C.SurfaceVariant, TEXT],
  [C.OnSurfaceVariant, C.Surface, TEXT],
  // Success is for icons and short labels on the page, not inside inputs.
  [C.Success, C.Background, TEXT],
  [C.Success, C.Surface, TEXT],
  // An input's outline is judged against what surrounds it, not its own fill.
  [C.BorderStrong, C.Surface, NON_TEXT],
  [C.BorderStrong, C.Background, NON_TEXT],
  // Secondary buttons are filled with Border.
  [C.Text, C.Border, TEXT],
];

describe.each([
  ["light", LightPalette],
  ["dark", DarkPalette],
] as [string, Palette][])("%s palette", (_, palette) => {
  it.each(PAIRS)("%s on %s reaches %s:1", (fg, bg, min) => {
    expect(contrast(palette[fg], palette[bg])).toBeGreaterThanOrEqual(min);
  });

  it("uses 6-digit hex for every solid colour, so a hex alpha can be appended", () => {
    for (const role of Object.values(C)) {
      if (role === C.Overlay) continue;
      expect(palette[role]).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});
