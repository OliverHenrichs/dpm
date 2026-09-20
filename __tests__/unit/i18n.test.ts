import fs from "fs";
import path from "path";
import en from "@/locales/en.json";
import de from "@/locales/de.json";
import { LANGUAGES } from "@/src/settings/types/Languages";

const SRC_DIR = path.join(__dirname, "..", "..", "src");

/** Every `.ts`/`.tsx` file under src/, recursively. */
function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

/**
 * Literal keys passed to `t(...)`. Dynamic calls — `t(route.titleKey)`,
 * `t(someVar)` — cannot be checked statically and are skipped; a literal
 * fallback inside one, such as `t(x ?? "literalKey")`, is still caught.
 */
function usedKeys(): Map<string, string[]> {
  const pattern = /\bt\(\s*"([A-Za-z0-9_.]+)"/g;
  const found = new Map<string, string[]>();

  for (const file of sourceFiles(SRC_DIR)) {
    const contents = fs.readFileSync(file, "utf8");
    for (const match of contents.matchAll(pattern)) {
      const key = match[1];
      const where = path.relative(SRC_DIR, file);
      found.set(key, [...(found.get(key) ?? []), where]);
    }
  }
  return found;
}

const locales: Record<string, Record<string, string>> = { en, de };

describe("i18n", () => {
  it("ships a locale file for every selectable language", () => {
    for (const language of LANGUAGES) {
      expect(Object.keys(locales)).toContain(language.code);
    }
  });

  describe("key parity", () => {
    const enKeys = Object.keys(en).sort();

    it.each(Object.keys(locales).filter((code) => code !== "en"))(
      "%s defines exactly the same keys as en",
      (code) => {
        const keys = Object.keys(locales[code]).sort();
        expect(keys.filter((k) => !enKeys.includes(k))).toEqual([]);
        expect(enKeys.filter((k) => !keys.includes(k))).toEqual([]);
      },
    );

    it.each(Object.keys(locales))("%s has no empty translations", (code) => {
      const empty = Object.entries(locales[code])
        .filter(([, value]) => typeof value !== "string" || value.trim() === "")
        .map(([key]) => key);
      expect(empty).toEqual([]);
    });

    it.each(Object.keys(locales))(
      "%s uses the same interpolation placeholders as en",
      (code) => {
        const placeholders = (value: string) =>
          [...value.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort();

        const mismatched = Object.keys(en).filter((key) => {
          const translated = locales[code][key];
          if (typeof translated !== "string") return false;
          return (
            placeholders(en[key as keyof typeof en]).join(",") !==
            placeholders(translated).join(",")
          );
        });

        expect(mismatched).toEqual([]);
      },
    );
  });

  describe("usage", () => {
    it('resolves every literal t("…") key used in src/', () => {
      const missing = [...usedKeys().entries()]
        .filter(([key]) => !(key in en))
        .map(([key, files]) => `${key} (used in ${files.join(", ")})`);

      expect(missing).toEqual([]);
    });

    it("finds keys at all, so a broken scanner cannot pass silently", () => {
      expect(usedKeys().size).toBeGreaterThan(50);
    });
  });
});
