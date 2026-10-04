import { Platform } from "react-native";
import { StyleSheet, UnistylesRuntime } from "react-native-unistyles";
import {
  AppStyle,
  AppTheme,
  buildTheme,
  ColorScheme,
  DEFAULT_APP_STYLE,
  nativeFonts,
  webFonts,
} from "@/src/common/theme/tokens";

/**
 * Registers the themes with Unistyles. This must run before any module calls
 * `StyleSheet.create`, which is why the app's entry (`index.ts`) imports it
 * ahead of expo-router.
 *
 * Unistyles knows two themes, "light" and "dark", so it can follow the system
 * on its own (adaptive themes) and web's static render can write both under
 * `prefers-color-scheme`. Which *style* fills them is swapped at runtime with
 * `applyAppStyle`; they start as the default style.
 */

/** A style's theme for this platform: embedded fonts on device, system stacks on web. */
export function themeFor(style: AppStyle, scheme: ColorScheme): AppTheme {
  const fonts = Platform.OS === "web" ? webFonts[style] : nativeFonts[style];
  return buildTheme(style, scheme, fonts);
}

const themes = {
  light: themeFor(DEFAULT_APP_STYLE, "light"),
  dark: themeFor(DEFAULT_APP_STYLE, "dark"),
};

/** Fills both registered themes with a style. Every Unistyles sheet follows natively. */
export function applyAppStyle(style: AppStyle): void {
  UnistylesRuntime.updateTheme("light", () => themeFor(style, "light"));
  UnistylesRuntime.updateTheme("dark", () => themeFor(style, "dark"));
}

/** Width at which a layout may use a second column: tablets, landscape phones, the web. */
const breakpoints = { xs: 0, md: 600, lg: 1024 };

type AppThemes = typeof themes;
type AppBreakpoints = typeof breakpoints;

// Unistyles is typed by augmenting these interfaces; they add no members of their own.
declare module "react-native-unistyles" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface UnistylesThemes extends AppThemes {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface UnistylesBreakpoints extends AppBreakpoints {}
}

StyleSheet.configure({
  themes,
  breakpoints,
  // Follow the system until the stored choice is restored; `ThemeProvider`
  // switches this off when the user picks light or dark.
  settings: { adaptiveThemes: true },
});
