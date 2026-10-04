/** WCAG 2.x relative luminance of a `#rrggbb` colour. */
export function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two `#rrggbb` colours, from 1 to 21. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Whether black reads better than white on a fill. For text on a colour the user chose, such
 * as a pattern type's, where no `on*` role can be fixed in advance.
 */
export function prefersDarkText(fill: string): boolean {
  if (!/^#[0-9a-f]{6}$/i.test(fill)) return false;
  // Black and white are the two candidates being measured, not colours drawn.
  // eslint-disable-next-line no-restricted-syntax
  const [black, white] = ["#000000", "#ffffff"];
  return contrast(fill, black) >= contrast(fill, white);
}
