import AsyncStorage from "@react-native-async-storage/async-storage";
import i18n, { restoreStoredLanguage } from "@/src/i18n";
import {
  peekAsyncStorage,
  seedAsyncStorage,
} from "@/__mocks__/@react-native-async-storage/async-storage";
import { setDeviceLocales } from "@/__mocks__/expo-localization";

/** Let the un-awaited save behind the `languageChanged` event land. */
const flush = () => new Promise((resolve) => setImmediate(resolve));

// The i18n instance is shared with every other suite, so put it back.
afterEach(async () => {
  if (i18n.language !== "en") await i18n.changeLanguage("en");
});

describe("language persistence", () => {
  it("comes up in the stored language", async () => {
    seedAsyncStorage({ "@language": "ar" });

    await restoreStoredLanguage();

    expect(i18n.language).toBe("ar");
    expect(i18n.t("language")).toBe("اللغة");
  });

  it("stays on the default when nothing was ever chosen", async () => {
    await restoreStoredLanguage();

    expect(i18n.language).toBe("en");
  });

  it("follows the device on a first launch", async () => {
    setDeviceLocales(["pt-BR", "en-US"]);

    await restoreStoredLanguage();

    expect(i18n.language).toBe("pt");
  });

  it("lets an explicit choice outrank the device", async () => {
    // Someone whose phone is in Portuguese but who picked English meant it.
    setDeviceLocales(["pt-BR"]);
    seedAsyncStorage({ "@language": "en" });

    await restoreStoredLanguage();

    expect(i18n.language).toBe("en");
  });

  it("stays on English for a device language we do not ship", async () => {
    setDeviceLocales(["is-IS"]);

    await restoreStoredLanguage();

    expect(i18n.language).toBe("en");
  });

  it("does not record the device language as a choice", async () => {
    // Writing it would freeze the app on today's device language; leaving
    // storage empty is what lets a phone switched to Spanish be followed.
    setDeviceLocales(["hi-IN"]);

    await restoreStoredLanguage();
    await flush();

    expect(i18n.language).toBe("hi");
    expect(peekAsyncStorage()["@language"]).toBeUndefined();
  });

  it("keeps following the device after it changes", async () => {
    setDeviceLocales(["hi-IN"]);
    await restoreStoredLanguage();
    await flush();

    setDeviceLocales(["fr-FR"]);
    await restoreStoredLanguage();

    expect(i18n.language).toBe("fr");
  });

  it("records the device's language once it is picked deliberately", async () => {
    // i18next emits `languageChanged` even for the already-active code, so
    // confirming what the device supplied still counts as a choice.
    setDeviceLocales(["de-DE"]);
    await restoreStoredLanguage();

    await i18n.changeLanguage("de");
    await flush();

    expect(peekAsyncStorage()["@language"]).toBe("de");
  });

  it("does not pin the default on a first launch", async () => {
    // i18next emits `languageChanged` from `init` too. Writing that would
    // record a choice the user never made, and a device-locale default
    // added later would then find English already sitting in storage.
    await restoreStoredLanguage();
    await flush();

    expect(peekAsyncStorage()["@language"]).toBeUndefined();
  });

  it("saves a language picked after startup", async () => {
    await restoreStoredLanguage();

    await i18n.changeLanguage("hi");
    await flush();

    expect(peekAsyncStorage()["@language"]).toBe("hi");
  });

  it("keeps saving across several changes", async () => {
    await restoreStoredLanguage();

    await i18n.changeLanguage("zh");
    await i18n.changeLanguage("pt");
    await flush();

    expect(peekAsyncStorage()["@language"]).toBe("pt");
  });

  it("still restores when it runs twice", async () => {
    // The root layout runs the effect once, but a fast refresh re-runs it.
    seedAsyncStorage({ "@language": "es" });

    await restoreStoredLanguage();
    await restoreStoredLanguage();
    await flush();

    expect(i18n.language).toBe("es");
  });

  it("subscribes once however often it runs", async () => {
    // Call counting rather than resulting state, unusually for this suite:
    // a doubled listener writes the same code twice, so the store afterwards
    // looks identical either way.
    await restoreStoredLanguage();
    await restoreStoredLanguage();
    const setItem = jest.spyOn(AsyncStorage, "setItem");

    await i18n.changeLanguage("fr");
    await flush();

    expect(setItem.mock.calls.filter(([key]) => key === "@language")).toEqual([
      ["@language", "fr"],
    ]);
    setItem.mockRestore();
  });
});
