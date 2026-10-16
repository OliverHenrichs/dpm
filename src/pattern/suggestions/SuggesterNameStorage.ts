import AsyncStorage from "@react-native-async-storage/async-storage";

const SUGGESTER_NAME_KEY = "@suggesterName";

/**
 * The name this phone last signed a suggestion with, offered again next time. A setting of the
 * app rather than of a list, so it outlives deleting lists. Read failures answer "none".
 */
export async function getSuggesterName(): Promise<string> {
  try {
    return (await AsyncStorage.getItem(SUGGESTER_NAME_KEY)) ?? "";
  } catch (error) {
    console.error("Error reading suggester name:", error);
    return "";
  }
}

export async function setSuggesterName(name: string): Promise<void> {
  try {
    const trimmed = name.trim();
    if (trimmed) await AsyncStorage.setItem(SUGGESTER_NAME_KEY, trimmed);
    else await AsyncStorage.removeItem(SUGGESTER_NAME_KEY);
  } catch (error) {
    console.error("Error saving suggester name:", error);
  }
}
