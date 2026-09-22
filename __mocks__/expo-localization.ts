/**
 * In-memory stand-in for `expo-localization`.
 *
 * Applied automatically to every test, like the AsyncStorage and file-system
 * mocks: a `__mocks__` directory beside `node_modules` needs no `jest.mock()`
 * call. It implements only `getLocales`, the one call the app makes, and
 * defaults to a US-English device so existing suites keep the behaviour they
 * were written against.
 *
 * `setDeviceLocales` sets what the next read reports; both setup files reset
 * it per test.
 */
interface MockLocale {
  languageTag: string;
  languageCode: string;
  regionCode: string | null;
}

const DEFAULT_LOCALES = ["en-US"];

let locales: string[] = [...DEFAULT_LOCALES];

export function getLocales(): MockLocale[] {
  return locales.map((languageTag) => {
    const [languageCode, regionCode] = languageTag.split("-");
    return { languageTag, languageCode, regionCode: regionCode ?? null };
  });
}

/** Report these tags, most-preferred first, until the next reset. */
export function setDeviceLocales(tags: string[]): void {
  locales = [...tags];
}

export function resetDeviceLocalesMock(): void {
  locales = [...DEFAULT_LOCALES];
}
