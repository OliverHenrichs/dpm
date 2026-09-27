import { Platform } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import {
  darkTheme,
  fontFamily,
  lightTheme,
  webFontStack,
  withFontFamily,
} from "@/src/common/theme/tokens";

/**
 * Registers the themes with Unistyles. This must run before any module calls
 * `StyleSheet.create`, which is why the app's entry (`index.ts`) imports it
 * ahead of expo-router.
 */

// Every text style carries the family, so a spread of `theme.typography.*`
// is all a style needs. Weights resolve within the family on both platforms.
const family = Platform.OS === "web" ? webFontStack : fontFamily;
const themes = {
  light: {
    ...lightTheme,
    typography: withFontFamily(lightTheme.typography, family),
  },
  dark: {
    ...darkTheme,
    typography: withFontFamily(darkTheme.typography, family),
  },
};

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
