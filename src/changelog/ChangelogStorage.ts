import AsyncStorage from "@react-native-async-storage/async-storage";

const SEEN_VERSION_KEY = "@changelogSeenVersion";
const HINT_ENABLED_KEY = "@whatsNewHintEnabled";

/**
 * The newest changelog version the user has been shown (or that was current when they installed),
 * or `null` if none was ever recorded. A failed read answers `null` too, which at worst shows the
 * newest entry once more.
 */
export async function loadSeenVersion(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(SEEN_VERSION_KEY);
  } catch (error) {
    console.error("Error reading the seen changelog version:", error);
    return null;
  }
}

export async function saveSeenVersion(version: string): Promise<void> {
  try {
    await AsyncStorage.setItem(SEEN_VERSION_KEY, version);
  } catch (error) {
    console.error("Error saving the seen changelog version:", error);
  }
}

/** Whether the what's-new hint shows after an update. On unless the user turned it off. */
export async function loadWhatsNewEnabled(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(HINT_ENABLED_KEY)) !== "false";
  } catch (error) {
    console.error("Error reading the what's-new setting:", error);
    return true;
  }
}

export async function saveWhatsNewEnabled(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(HINT_ENABLED_KEY, enabled ? "true" : "false");
  } catch (error) {
    console.error("Error saving the what's-new setting:", error);
  }
}
