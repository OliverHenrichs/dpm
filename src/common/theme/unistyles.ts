import { StyleSheet } from "react-native-unistyles";
import { darkTheme, lightTheme } from "@/src/common/theme/tokens";

/**
 * Registers the themes with Unistyles. This must run before any module calls
 * `StyleSheet.create`, which is why the app's entry (`index.ts`) imports it
 * ahead of expo-router.
 */

const themes = { light: lightTheme, dark: darkTheme };

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
