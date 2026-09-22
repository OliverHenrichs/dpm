import { getLocales } from "expo-localization";

/**
 * The device's preferred language tags, most-preferred first (`["pt-BR",
 * "en-US"]`).
 *
 * The whole of the native surface this feature needs, deliberately: the
 * matching against what we ship lives in `resolveDeviceLanguage`, which is
 * pure and testable. A failure answers "no preference" rather than throwing,
 * because this runs on the startup path and English is a working app.
 */
export function getDeviceLocales(): string[] {
  try {
    return getLocales()
      .map((locale) => locale.languageTag)
      .filter((tag): tag is string => Boolean(tag));
  } catch (error) {
    console.error("Error reading device locales:", error);
    return [];
  }
}
