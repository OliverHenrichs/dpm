import { validateExportData } from "@/src/pattern/data/validation/validateExportData";
import {
  formatImportMessage,
  IMPORT_MESSAGE_KEYS,
  ImportMessage,
} from "@/src/pattern/data/validation/importMessages";
import { createTestPattern } from "@/utils/testFactories";
import { LOCALES, translatorFor } from "@/utils/importMessageText";

/**
 * The importer picks its keys at runtime, which the static `t("…")` scan in
 * i18n.test.ts cannot see, so they are checked here instead.
 */
describe("importer messages", () => {
  const CONTEXT_KEYS = [
    "importContextList",
    "importContextPattern",
    "importContextModifier",
    "importMessageInContext",
  ];

  it.each(Object.keys(LOCALES))("has every importer key in %s", (language) => {
    const missing = [...IMPORT_MESSAGE_KEYS, ...CONTEXT_KEYS].filter(
      (key) => !LOCALES[language][key]?.trim(),
    );
    expect(missing).toEqual([]);
  });

  it("puts where the problem is in front of what it is", () => {
    const message: ImportMessage = {
      key: "importWarnMalformedTranscriptLines",
      params: { count: 3 },
      context: { list: "Thursday", pattern: "Whip" },
    };

    expect(formatImportMessage(translatorFor("en"), message)).toBe(
      'List "Thursday", pattern "Whip": Dropped 3 malformed transcript line(s).',
    );
    expect(formatImportMessage(translatorFor("de"), message)).toBe(
      'Liste "Thursday", Figur "Whip": 3 fehlerhafte Transkriptzeile(n) verworfen.',
    );
  });

  it("names a modifier when the problem is on one", () => {
    const message: ImportMessage = {
      key: "importWarnMalformedVideo",
      context: { list: "Thursday", modifier: "with hesitation" },
    };

    expect(formatImportMessage(translatorFor("fr"), message)).toBe(
      "Liste « Thursday », modificateur « with hesitation » : Une référence vidéo mal formée a été supprimée.",
    );
  });

  it("translates what the validator reports, in every locale", () => {
    // One fatal problem with a parameter, and repairs at list, pattern and
    // file level, so each shape of message goes through a real run.
    const TYPE_ID = "type-1";
    const file = (patterns: unknown[]) => ({
      version: "3.2.0",
      exportDate: "",
      includesVideos: true,
      videos: { "a.mp4": 42 },
      patternLists: [
        {
          id: "list-1",
          name: "Thursday",
          patternTypes: [{ id: TYPE_ID, slug: "whip", color: "#000" }],
          modifiers: "nope",
          patterns,
        },
      ],
    });
    const repaired = validateExportData(
      file([
        createTestPattern(TYPE_ID, { id: 1, name: "A", prerequisites: [9] }),
      ]),
    );
    const refused = validateExportData(
      file([
        createTestPattern(TYPE_ID, { id: 1, name: "A" }),
        createTestPattern(TYPE_ID, { id: 1, name: "B" }),
      ]),
    );
    const messages = [...refused.errors, ...repaired.warnings];
    expect(messages.map((m) => m.key)).toEqual(
      expect.arrayContaining([
        "importErrorDuplicatePatternId",
        "importWarnModifiersNotList",
        "importWarnPrerequisiteNotInFile",
        "importWarnVideoEntryUnreadable",
      ]),
    );

    for (const language of Object.keys(LOCALES)) {
      const t = translatorFor(language);
      for (const message of messages) {
        const text = formatImportMessage(t, message);
        // A missing key comes back as the key itself; a missed placeholder as braces.
        expect(text).not.toMatch(/import[A-Z]|\{\{/);
        for (const value of Object.values(message.params ?? {})) {
          expect(text).toContain(String(value));
        }
        if (message.context) expect(text).toContain("Thursday");
      }
    }
  });
});
