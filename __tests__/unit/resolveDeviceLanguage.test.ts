import { resolveDeviceLanguage } from "@/src/settings/types/Languages";

describe("resolveDeviceLanguage", () => {
  it("takes a language we ship", () => {
    expect(resolveDeviceLanguage(["fr"])).toBe("fr");
  });

  it("drops the region when there is no exact match", () => {
    expect(resolveDeviceLanguage(["pt-BR"])).toBe("pt");
    expect(resolveDeviceLanguage(["en-GB"])).toBe("en");
  });

  it("handles a script subtag too", () => {
    // Our zh is Simplified; a Traditional reader gets it rather than English.
    expect(resolveDeviceLanguage(["zh-Hant-TW"])).toBe("zh");
  });

  it("is not case sensitive", () => {
    expect(resolveDeviceLanguage(["PT-br"])).toBe("pt");
  });

  it("honours the device's order of preference", () => {
    // Second choice German must not beat first choice Spanish.
    expect(resolveDeviceLanguage(["es-MX", "de-DE"])).toBe("es");
  });

  it("skips preferences we do not ship and keeps looking", () => {
    expect(resolveDeviceLanguage(["is-IS", "sw", "hi-IN"])).toBe("hi");
  });

  it("answers null when we ship none of them", () => {
    expect(resolveDeviceLanguage(["is-IS", "sw"])).toBeNull();
  });

  it("answers null for a device that reports nothing", () => {
    expect(resolveDeviceLanguage([])).toBeNull();
    expect(resolveDeviceLanguage([""])).toBeNull();
  });
});
