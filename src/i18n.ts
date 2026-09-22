import i18n from "i18next";
import { initReactI18next } from "react-i18next";
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
  loadStoredLanguage,
  saveLanguage,
} from "@/src/settings/data/LanguageStorage";

// Keyed by the same codes as `LANGUAGES` in src/settings/types/Languages.ts.
const resources = {
  en: { translation: en },
  zh: { translation: zh },
  hi: { translation: hi },
  es: { translation: es },
  fr: { translation: fr },
  ar: { translation: ar },
  bn: { translation: bn },
  pt: { translation: pt },
  de: { translation: de },
};

/* eslint-disable import/no-named-as-default-member */
i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: "en",
    fallbackLng: "en",
    interpolation: { escapeValue: false },
  })
  .catch((err) => {
    console.log("i18n initialization error:", err);
  });

let persisting = false;

/**
 * Apply the stored language, then keep storage in step with every later
 * change.
 *
 * Called once from the root layout, which holds the splash screen until it
 * resolves — `init` above is synchronous and has to name a language, so
 * rendering before this lands would show a frame of English to someone who
 * chose something else.
 *
 * Subscribing only *after* the stored value is applied is deliberate:
 * `init` itself emits `languageChanged`, so an earlier subscription would
 * write the hard-coded default on first launch and pin "en" for someone who
 * never picked it — which is exactly what a device-locale default would then
 * have to fight.
 */
export async function restoreStoredLanguage(): Promise<void> {
  const stored = await loadStoredLanguage();
  if (stored && stored !== i18n.language) {
    await i18n.changeLanguage(stored);
  }

  if (persisting) return;
  persisting = true;
  // On the event rather than at the call site, so a language picked anywhere
  // — now or later — is saved without that screen having to remember to.
  i18n.on("languageChanged", (code: string) => {
    void saveLanguage(code);
  });
}
/* eslint-enable import/no-named-as-default-member */

export default i18n;
