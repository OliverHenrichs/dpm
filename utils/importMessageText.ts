import { createInstance } from "i18next";
import ar from "@/locales/ar.json";
import bn from "@/locales/bn.json";
import de from "@/locales/de.json";
import en from "@/locales/en.json";
import es from "@/locales/es.json";
import fr from "@/locales/fr.json";
import hi from "@/locales/hi.json";
import pt from "@/locales/pt.json";
import zh from "@/locales/zh.json";
import {
  formatImportMessages,
  ImportMessage,
  Translate,
} from "@/src/pattern/data/validation/importMessages";

export const LOCALES: Record<string, Record<string, string>> = {
  en,
  zh,
  hi,
  es,
  fr,
  ar,
  bn,
  pt,
  de,
};

/**
 * A real i18next `t` for one shipped locale, without the app's setup (device
 * locale, stored language), so pure-logic tests can read translated text.
 */
export function translatorFor(language: string): Translate {
  const instance = createInstance();
  instance.init({
    resources: { [language]: { translation: LOCALES[language] } },
    lng: language,
    initAsync: false,
    interpolation: { escapeValue: false },
  });
  return (key, params) => instance.t(key, params);
}

/** The importer's messages as an English reader sees them, one per line. */
export const importText = (messages: ImportMessage[]) =>
  formatImportMessages(translatorFor("en"), messages);
