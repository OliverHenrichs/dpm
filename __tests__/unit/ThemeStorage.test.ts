import AsyncStorage from "@react-native-async-storage/async-storage";
import { loadStoredTheme, saveTheme } from "@/src/settings/data/ThemeStorage";
import {
  peekAsyncStorage,
  seedAsyncStorage,
} from "@/__mocks__/@react-native-async-storage/async-storage";

describe("ThemeStorage", () => {
  it("reads back what it wrote", async () => {
    await saveTheme("dark");

    expect(await loadStoredTheme()).toBe("dark");
  });

  it("answers null when nothing was ever chosen", async () => {
    expect(await loadStoredTheme()).toBeNull();
  });

  it("stores the choice under a key of its own", async () => {
    // Its own key, not folded into a list's data: the choice is about the
    // app and must survive deleting every pattern list.
    await saveTheme("light");

    expect(peekAsyncStorage()["@theme"]).toBe("light");
  });

  it("ignores a stored value that is not a theme", async () => {
    seedAsyncStorage({ "@theme": "sepia" });

    expect(await loadStoredTheme()).toBeNull();
  });

  describe("when storage itself fails", () => {
    // Startup must not die on a broken store: following the system works.
    let consoleError: jest.SpyInstance;

    beforeEach(() => {
      consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => consoleError.mockRestore());

    it("reads as no stored choice", async () => {
      jest
        .spyOn(AsyncStorage, "getItem")
        .mockRejectedValueOnce(new Error("store unavailable"));

      await expect(loadStoredTheme()).resolves.toBeNull();
    });

    it("swallows a failed write rather than rejecting", async () => {
      jest
        .spyOn(AsyncStorage, "setItem")
        .mockRejectedValueOnce(new Error("disk full"));

      await expect(saveTheme("dark")).resolves.toBeUndefined();
    });
  });
});
