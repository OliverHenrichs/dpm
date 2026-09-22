export interface Language {
  /** BCP 47 code; also the basename of the file in `locales/`. */
  code: string;
  /** The language's own name, shown as the primary label. */
  label: string;
  /**
   * The English name, shown underneath. This is the way back: someone who
   * switches to a script they cannot read still recognises "Bengali".
   */
  englishName: string;
}

/**
 * Selectable languages, English first and the rest by descending number of
 * speakers. `locales/<code>.json` must exist for every entry — the i18n suite
 * fails the build otherwise.
 */
export const LANGUAGES: Language[] = [
  { code: "en", label: "English", englishName: "English" },
  { code: "zh", label: "中文", englishName: "Chinese" },
  { code: "hi", label: "हिन्दी", englishName: "Hindi" },
  { code: "es", label: "Español", englishName: "Spanish" },
  { code: "fr", label: "Français", englishName: "French" },
  { code: "ar", label: "العربية", englishName: "Arabic" },
  { code: "bn", label: "বাংলা", englishName: "Bengali" },
  { code: "pt", label: "Português", englishName: "Portuguese" },
  { code: "de", label: "Deutsch", englishName: "German" },
];

/** The entry for `code`, falling back to English for an unknown one. */
export const findLanguage = (code: string): Language =>
  LANGUAGES.find((language) => language.code === code) ??
  LANGUAGES.find((language) => code.split("-")[0] === language.code) ??
  LANGUAGES[0];

/**
 * The best language we ship for a device's ordered locale preferences, or
 * `null` if we ship none of them.
 *
 * Kept pure and separate from the native call that produces `deviceLocales`
 * so the matching — the part with the edge cases — is testable without a
 * device. Order matters: the list arrives most-preferred first, and a later
 * locale must never win over an earlier one.
 *
 * Region is dropped when there is no exact match, so `pt-BR` settles for our
 * European `pt` rather than for nothing. The same fallback hands `zh-Hant`
 * our Simplified `zh`, which is a compromise, not a match — but a Traditional
 * reader is still better served by Simplified than by English, and either way
 * the picker is one tap away.
 */
export const resolveDeviceLanguage = (
  deviceLocales: readonly string[],
): string | null => {
  for (const locale of deviceLocales) {
    if (!locale) continue;
    const tag = locale.toLowerCase();
    const exact = LANGUAGES.find((language) => language.code === tag);
    if (exact) return exact.code;

    const base = tag.split("-")[0];
    const byBase = LANGUAGES.find((language) => language.code === base);
    if (byBase) return byBase.code;
  }
  return null;
};
