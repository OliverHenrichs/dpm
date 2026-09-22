import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  loadStoredLanguage,
  saveLanguage,
} from "@/src/settings/data/LanguageStorage";
import {
  peekAsyncStorage,
  seedAsyncStorage,
} from "@/__mocks__/@react-native-async-storage/async-storage";

describe("LanguageStorage", () => {
  it("reads back what it wrote", async () => {
    await saveLanguage("bn");

    expect(await loadStoredLanguage()).toBe("bn");
  });

  it("answers null when nothing was ever chosen", async () => {
    expect(await loadStoredLanguage()).toBeNull();
  });

  it("stores the code under a key of its own", async () => {
    // Its own key, not folded into a list's data: the choice is about the
    // app and must survive deleting every pattern list.
    await saveLanguage("fr");

    expect(peekAsyncStorage()["@language"]).toBe("fr");
  });

  it("ignores a code we no longer ship", async () => {
    // Dropping a locale would otherwise strand whoever had picked it on a
    // resource bundle that is not there any more.
    seedAsyncStorage({ "@language": "eo" });

    expect(await loadStoredLanguage()).toBeNull();
  });

  it("ignores a stored value that is not a language at all", async () => {
    seedAsyncStorage({ "@language": "{}" });

    expect(await loadStoredLanguage()).toBeNull();
  });

  describe("when storage itself fails", () => {
    // Startup must not die on a broken store: English is a working app.
    let consoleError: jest.SpyInstance;

    beforeEach(() => {
      consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => consoleError.mockRestore());

    it("reads as no stored choice", async () => {
      jest
        .spyOn(AsyncStorage, "getItem")
        .mockRejectedValueOnce(new Error("store unavailable"));

      await expect(loadStoredLanguage()).resolves.toBeNull();
    });

    it("swallows a failed write rather than rejecting", async () => {
      jest
        .spyOn(AsyncStorage, "setItem")
        .mockRejectedValueOnce(new Error("disk full"));

      await expect(saveLanguage("zh")).resolves.toBeUndefined();
    });
  });
});
