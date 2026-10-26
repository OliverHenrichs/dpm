import AsyncStorage from "@react-native-async-storage/async-storage";

const TERMS_ACCEPTED_KEY = "@termsAccepted";

/**
 * The version of the terms of use the app asks agreement to: the "Last updated" date of
 * `TERMS_OF_USE.md`. Change it only for a change that matters for what people share, and
 * everyone is asked again before their next share.
 */
export const TERMS_VERSION = "2026-10-20";

/** Whether this phone agreed to the current terms. Read failures answer "no", which only asks again. */
export async function hasAcceptedTerms(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(TERMS_ACCEPTED_KEY)) === TERMS_VERSION;
  } catch (error) {
    console.error("Error reading terms agreement:", error);
    return false;
  }
}

export async function acceptTerms(): Promise<void> {
  try {
    await AsyncStorage.setItem(TERMS_ACCEPTED_KEY, TERMS_VERSION);
  } catch (error) {
    console.error("Error saving terms agreement:", error);
  }
}
