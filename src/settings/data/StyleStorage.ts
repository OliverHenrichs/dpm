import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppStyle, isAppStyle } from "@/src/common/theme/tokens";

const STYLE_KEY = "@appStyle";

/**
 * The style the user last chose, or `null` to keep the default. A value that is
 * not a style we still ship, or a failed read, answers `null` too.
 */
export async function loadStoredStyle(): Promise<AppStyle | null> {
  try {
    const stored = await AsyncStorage.getItem(STYLE_KEY);
    return isAppStyle(stored) ? stored : null;
  } catch (error) {
    console.error("Error reading stored style:", error);
    return null;
  }
}

export async function saveStyle(style: AppStyle): Promise<void> {
  try {
    await AsyncStorage.setItem(STYLE_KEY, style);
  } catch (error) {
    console.error("Error saving style:", error);
  }
}
