/** Every theme choice the settings screen offers. */
export const THEMES = ["light", "dark", "system"] as const;

export type ThemeType = (typeof THEMES)[number];

export function isThemeType(value: unknown): value is ThemeType {
  return THEMES.includes(value as ThemeType);
}
