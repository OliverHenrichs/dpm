import fs from "fs";
import path from "path";
import {
  CHANGELOG,
  ChangelogEntry,
  compareVersions,
  decideWhatsNew,
  notesFor,
} from "@/src/changelog/changelog";
import {
  loadSeenVersion,
  loadWhatsNewEnabled,
  saveSeenVersion,
  saveWhatsNewEnabled,
} from "@/src/changelog/ChangelogStorage";
import { LANGUAGES } from "@/src/settings/types/Languages";
import {
  peekAsyncStorage,
  seedAsyncStorage,
} from "@/__mocks__/@react-native-async-storage/async-storage";

const root = path.join(__dirname, "..", "..");

const entry = (version: string): ChangelogEntry => ({
  version,
  notes: { en: [`Changes in ${version}`] },
});

describe("the changelog", () => {
  it("starts with the app's version", () => {
    // A release without an entry would never show its hint.
    const pkg = JSON.parse(
      fs.readFileSync(path.join(root, "package.json"), "utf8"),
    );
    const config = fs.readFileSync(path.join(root, "app.config.ts"), "utf8");
    const configVersion = config.match(/\bversion:\s*"([^"]+)"/)?.[1];

    expect(CHANGELOG[0].version).toBe(pkg.version);
    expect(CHANGELOG[0].version).toBe(configVersion);
  });

  it("lists versions newest first, each once", () => {
    for (let i = 1; i < CHANGELOG.length; i++) {
      expect(
        compareVersions(CHANGELOG[i - 1].version, CHANGELOG[i].version),
      ).toBeGreaterThan(0);
    }
  });

  it.each(CHANGELOG.map((e) => [e.version, e] as const))(
    "has %s in every shipped language, note for note",
    (_version, e) => {
      const count = e.notes.en.length;
      expect(count).toBeGreaterThan(0);
      for (const { code } of LANGUAGES) {
        expect(e.notes[code]).toHaveLength(count);
        for (const note of e.notes[code]) expect(note.trim()).not.toBe("");
      }
      expect(Object.keys(e.notes).sort()).toEqual(
        LANGUAGES.map((l) => l.code).sort(),
      );
    },
  );

  it("dates released entries as YYYY-MM-DD", () => {
    for (const e of CHANGELOG) {
      if (e.date) expect(e.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

describe("compareVersions", () => {
  it("compares numerically, part by part", () => {
    expect(compareVersions("1.0.10", "1.0.9")).toBeGreaterThan(0);
    expect(compareVersions("1.2.0", "1.10.0")).toBeLessThan(0);
    expect(compareVersions("2.0.0", "2.0.0")).toBe(0);
    expect(compareVersions("1.0", "1.0.0")).toBe(0);
  });
});

describe("notesFor", () => {
  const e: ChangelogEntry = {
    version: "1.0.0",
    notes: { en: ["English"], pt: ["Português"] },
  };

  it("picks the language, then its base, then English", () => {
    expect(notesFor(e, "pt")).toEqual(["Português"]);
    expect(notesFor(e, "pt-BR")).toEqual(["Português"]);
    expect(notesFor(e, "de")).toEqual(["English"]);
  });
});

describe("decideWhatsNew", () => {
  const entries = [entry("1.2.0"), entry("1.1.0"), entry("1.0.0")];
  const base = { entries, hintEnabled: true, hasExistingData: true };

  it("shows nothing on a first install, and records the version", () => {
    expect(
      decideWhatsNew({ ...base, seenVersion: null, hasExistingData: false }),
    ).toEqual({ show: [], markSeen: "1.2.0" });
  });

  it("shows the newest entry after an update from a build without the hint", () => {
    expect(decideWhatsNew({ ...base, seenVersion: null })).toEqual({
      show: [entries[0]],
      markSeen: "1.2.0",
    });
  });

  it("shows every version since the one last seen", () => {
    expect(decideWhatsNew({ ...base, seenVersion: "1.0.0" })).toEqual({
      show: [entries[0], entries[1]],
      markSeen: "1.2.0",
    });
  });

  it("shows nothing when the newest version was already seen", () => {
    expect(decideWhatsNew({ ...base, seenVersion: "1.2.0" })).toEqual({
      show: [],
      markSeen: null,
    });
  });

  it("records the version without showing it when the hint is off", () => {
    // So turning it back on does not replay every update since.
    expect(
      decideWhatsNew({ ...base, seenVersion: "1.0.0", hintEnabled: false }),
    ).toEqual({ show: [], markSeen: "1.2.0" });
  });
});

describe("ChangelogStorage", () => {
  it("has no seen version until one is saved", async () => {
    expect(await loadSeenVersion()).toBeNull();
    await saveSeenVersion("1.0.1");
    expect(await loadSeenVersion()).toBe("1.0.1");
  });

  it("keeps the hint on unless it was turned off", async () => {
    expect(await loadWhatsNewEnabled()).toBe(true);
    await saveWhatsNewEnabled(false);
    expect(await loadWhatsNewEnabled()).toBe(false);
    expect(peekAsyncStorage()["@whatsNewHintEnabled"]).toBe("false");
  });

  it("treats an unexpected stored value as on", async () => {
    seedAsyncStorage({ "@whatsNewHintEnabled": "maybe" });
    expect(await loadWhatsNewEnabled()).toBe(true);
  });
});
