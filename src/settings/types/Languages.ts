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
