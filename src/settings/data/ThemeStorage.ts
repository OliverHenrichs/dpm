import AsyncStorage from "@react-native-async-storage/async-storage";
import { isThemeType, ThemeType } from "@/src/settings/types/Themes";

const THEME_KEY = "@theme";

/**
 * The theme the user last chose, or `null` to leave the default alone.
 *
 * Anything that is not a theme we still offer answers `null` rather than
 * reaching the palette lookup, and so does a read failure — following the
 * system is a working app, a rejected promise on startup is not.
 */
export async function loadStoredTheme(): Promise<ThemeType | null> {
  try {
    const stored = await AsyncStorage.getItem(THEME_KEY);
    return isThemeType(stored) ? stored : null;
  } catch (error) {
    console.error("Error reading stored theme:", error);
    return null;
  }
}

export async function saveTheme(theme: ThemeType): Promise<void> {
  try {
    await AsyncStorage.setItem(THEME_KEY, theme);
  } catch (error) {
    console.error("Error saving theme:", error);
  }
}
