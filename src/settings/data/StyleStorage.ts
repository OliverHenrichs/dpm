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

const COMPACT_LIST_KEY = "@compactList";

/** Whether the pattern list is in compact mode; off unless chosen, or when the read fails. */
export async function loadStoredCompactList(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(COMPACT_LIST_KEY)) === "true";
  } catch (error) {
    console.error("Error reading compact list setting:", error);
    return false;
  }
}

export async function saveCompactList(compact: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(COMPACT_LIST_KEY, String(compact));
  } catch (error) {
    console.error("Error saving compact list setting:", error);
  }
}
