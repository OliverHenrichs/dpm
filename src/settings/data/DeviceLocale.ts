/** Typed without importing: see the require inside `getDeviceLocales`. */
type Localization = typeof import("expo-localization");

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
    // Required here rather than imported at the top of the file, and this is
    // load-bearing: expo-localization reads the native module at *module*
    // scope (`export const getLocales = ExpoLocalization.getLocales`), so a
    // static import throws while the bundle is still evaluating, long before
    // any try/catch of ours runs. That took the whole app down on a build
    // without the native module — an older dev client, or Expo Go — with the
    // root layout reported as "missing the required default export", because
    // it never finished evaluating. Requiring lazily keeps the failure inside
    // this function, where it costs the device default and nothing else.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getLocales } = require("expo-localization") as Localization;

    return getLocales()
      .map((locale) => locale.languageTag)
      .filter((tag): tag is string => Boolean(tag));
  } catch (error) {
    console.error("Error reading device locales:", error);
    return [];
  }
}
