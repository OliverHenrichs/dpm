import AsyncStorage from "@react-native-async-storage/async-storage";
import i18n, { restoreStoredLanguage } from "@/src/i18n";
import {
  peekAsyncStorage,
  seedAsyncStorage,
} from "@/__mocks__/@react-native-async-storage/async-storage";

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
