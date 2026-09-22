import AsyncStorage from "@react-native-async-storage/async-storage";
import { LANGUAGES } from "@/src/settings/types/Languages";

const LANGUAGE_KEY = "@language";

/**
 * The language the user last chose, or `null` to leave the default alone.
 *
 * A stored code is only honoured while we still ship that locale: dropping a
 * language would otherwise strand everyone who had picked it on a resource
 * bundle that no longer exists, with no way back but a reinstall. Read
 * failures answer `null` for the same reason — English is a working app,
 * a rejected promise on startup is not.
 */
export async function loadStoredLanguage(): Promise<string | null> {
  try {
    const stored = await AsyncStorage.getItem(LANGUAGE_KEY);
    if (!stored) return null;
    return LANGUAGES.some((language) => language.code === stored)
      ? stored
      : null;
  } catch (error) {
    console.error("Error reading stored language:", error);
    return null;
  }
}

export async function saveLanguage(code: string): Promise<void> {
  try {
    await AsyncStorage.setItem(LANGUAGE_KEY, code);
  } catch (error) {
    console.error("Error saving language:", error);
  }
}
