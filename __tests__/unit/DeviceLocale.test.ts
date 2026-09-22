import * as Localization from "expo-localization";
import { getDeviceLocales } from "@/src/settings/data/DeviceLocale";
import { setDeviceLocales } from "@/__mocks__/expo-localization";

describe("getDeviceLocales", () => {
  it("reports the device's tags, most-preferred first", () => {
    setDeviceLocales(["pt-BR", "en-US"]);

    expect(getDeviceLocales()).toEqual(["pt-BR", "en-US"]);
  });

  it("answers no preference when the device reports none", () => {
    setDeviceLocales([]);

    expect(getDeviceLocales()).toEqual([]);
  });

  it("answers no preference rather than throwing", () => {
    // This runs on the startup path; a native module that misbehaves must
    // cost the device default, not the launch.
    jest.spyOn(Localization, "getLocales").mockImplementation(() => {
      throw new Error("no native module");
    });

    expect(getDeviceLocales()).toEqual([]);
  });
});
