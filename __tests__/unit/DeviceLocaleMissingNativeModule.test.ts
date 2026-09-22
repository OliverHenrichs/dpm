// Reproduces the startup crash on a build without the native module: an
// older dev client, or Expo Go. expo-localization resolves it at module
// scope, so the failure lands on `require`, not on the call — which is why
// this mocks the whole module into throwing rather than just its function.
jest.mock("expo-localization", () => {
  throw new Error("Cannot find native module 'ExpoLocalization'");
});

describe("with the native module missing", () => {
  it("still loads the module that reads locales", () => {
    // A static import here used to take the bundle down while it was still
    // evaluating, which surfaced as the root layout "missing the required
    // default export".
    expect(() => require("@/src/settings/data/DeviceLocale")).not.toThrow();
  });

  it("reports no device preference instead of throwing", () => {
    const { getDeviceLocales } =
      require("@/src/settings/data/DeviceLocale") as typeof import("@/src/settings/data/DeviceLocale");

    expect(getDeviceLocales()).toEqual([]);
  });

  it("still brings i18n up in English", async () => {
    const { default: i18n, restoreStoredLanguage } =
      require("@/src/i18n") as typeof import("@/src/i18n");

    await restoreStoredLanguage();

    expect(i18n.language).toBe("en");
    expect(i18n.t("language")).toBe("Language");
  });
});
