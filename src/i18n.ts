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
import { getDeviceLocales } from "@/src/settings/data/DeviceLocale";
import {
  loadStoredLanguage,
  saveLanguage,
} from "@/src/settings/data/LanguageStorage";
import { resolveDeviceLanguage } from "@/src/settings/types/Languages";

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
let applying = false;

/**
 * Settle on a language — the stored choice, else the device's — and then keep
 * storage in step with every later change.
 *
 * Called once from the root layout, which holds the splash screen until it
 * resolves: `init` above is synchronous and has to name a language, so what
 * renders before this lands is English regardless of who is holding the
 * phone.
 *
 * An explicit choice always outranks the device. Someone whose phone is in
 * Portuguese but who picked English meant it, and a stored code is not
 * re-derived on later launches.
 *
 * Nothing derived ever reaches storage — only a language someone picked —
 * which is what lets a phone switched to another language still be followed
 * on the next launch. Two things enforce that, because `init` and the call
 * above both emit `languageChanged` and the event cannot tell a choice from a
 * restore: the subscription is made only after the restore, and the restore
 * flags itself for the case where a listener is already live.
 */
export async function restoreStoredLanguage(): Promise<void> {
  const stored = await loadStoredLanguage();
  const target = stored ?? resolveDeviceLanguage(getDeviceLocales());
  if (target && target !== i18n.language) {
    // Flagged so the listener below ignores this one. The event cannot tell a
    // choice from a restore, and on a second run — a fast refresh re-running
    // the effect — the listener is already live, so an unflagged restore
    // would write the *derived* code and freeze the app on whatever the
    // device said today.
    applying = true;
    try {
      await i18n.changeLanguage(target);
    } finally {
      applying = false;
    }
  }

  if (persisting) return;
  persisting = true;
  // On the event rather than at the call site, so a language picked anywhere
  // — now or later — is saved without that screen having to remember to.
  // i18next emits this even when the code is already active, so re-picking
  // the language the device happened to supply still records it as a choice.
  i18n.on("languageChanged", (code: string) => {
    if (applying) return;
    void saveLanguage(code);
  });
}
/* eslint-enable import/no-named-as-default-member */

export default i18n;
