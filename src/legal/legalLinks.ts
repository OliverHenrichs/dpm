import { Linking } from "react-native";

/**
 * The terms of use and the privacy policy, rendered from `TERMS_OF_USE.md` and `PRIVACY_POLICY.md`
 * by `website/build-privacy.py`. They move with the website (`website/README.md`, "Moving the site").
 */
export const TERMS_URL = "https://dancepatternmapper.com/terms.html";
export const PRIVACY_URL = "https://dancepatternmapper.com/privacy.html";

/** Opens a page in the browser; a phone without one keeps the app as it was. */
export function openLegalPage(url: string): void {
  Linking.openURL(url).catch((e: unknown) =>
    console.warn("Opening", url, "failed:", e),
  );
}
