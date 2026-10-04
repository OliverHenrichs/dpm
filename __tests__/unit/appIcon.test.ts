import {
  canChangeAppIcon,
  currentAppIconColor,
  setAppIconColor,
} from "@/src/settings/appIcon";
import {
  getAppIconName,
  setAlternateAppIcon,
  setAlternateIconsSupported,
} from "@/__mocks__/expo-alternate-app-icons";

describe("app icon colour", () => {
  it("starts on the default indigo icon", () => {
    expect(canChangeAppIcon()).toBe(true);
    expect(currentAppIconColor()).toBe("indigo");
  });

  it("switches to an alternate icon and back to the default", async () => {
    await expect(setAppIconColor("amber")).resolves.toBe(true);
    expect(getAppIconName()).toBe("Amber");
    expect(currentAppIconColor()).toBe("amber");

    await expect(setAppIconColor("indigo")).resolves.toBe(true);
    expect(setAlternateAppIcon).toHaveBeenLastCalledWith(null);
    expect(currentAppIconColor()).toBe("indigo");
  });

  it("reads an icon it does not know as the default", () => {
    getAppIconName.mockReturnValueOnce("Teal");
    expect(currentAppIconColor()).toBe("indigo");
  });

  it("falls back to indigo when the icon cannot be read", () => {
    getAppIconName.mockImplementationOnce(() => {
      throw new Error("no activity");
    });
    expect(currentAppIconColor()).toBe("indigo");
  });

  it("does nothing where the platform has no alternate icons", async () => {
    setAlternateIconsSupported(false);
    expect(canChangeAppIcon()).toBe(false);
    await expect(setAppIconColor("coral")).resolves.toBe(false);
    expect(getAppIconName()).toBeNull();
  });

  it("reports a switch the platform refused", async () => {
    setAlternateAppIcon.mockRejectedValueOnce(new Error("refused"));
    await expect(setAppIconColor("coral")).resolves.toBe(false);
    expect(console.error).toHaveBeenCalled();
  });
});
