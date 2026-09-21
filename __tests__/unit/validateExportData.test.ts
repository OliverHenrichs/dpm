import { validateExportData } from "@/src/pattern/data/validation/validateExportData";
import {
  canImport,
  parseVersion,
} from "@/src/pattern/data/types/ExportVersion";
import { exportDataVersion } from "@/src/pattern/data/types/IExportData";
import {
  createTestPattern,
  createTestPatternList,
  createTestPatternType,
} from "@/utils/testFactories";
import { generateUUID } from "@/src/pattern/types/PatternType";

const TYPE = createTestPatternType({ slug: "push" });

/** A minimal file that should always import cleanly. */
function validFile(overrides: Record<string, unknown> = {}) {
  const list = createTestPatternList({ patternTypes: [TYPE] });
  return {
    version: exportDataVersion,
    exportDate: new Date().toISOString(),
    includesVideos: false,
    patternLists: [
      { ...list, patterns: [createTestPattern(TYPE.id, { id: 1 })] },
    ],
    videos: {},
    ...overrides,
  };
}

/** Build a file around one hand-made list. */
function fileWithList(list: Record<string, unknown>) {
  return validFile({ patternLists: [list] });
}

const baseList = (overrides: Record<string, unknown> = {}) => ({
  ...createTestPatternList({ patternTypes: [TYPE] }),
  patterns: [],
  ...overrides,
});

describe("parseVersion", () => {
  it("reads a three-part version", () => {
    expect(parseVersion("3.1.4")).toEqual({ major: 3, minor: 1, patch: 4 });
  });

  it("tolerates surrounding whitespace", () => {
    expect(parseVersion("  3.0.0 ")).toEqual({ major: 3, minor: 0, patch: 0 });
  });

  it.each([
    ["not a version", "hello"],
    ["two parts", "3.0"],
    ["four parts", "3.0.0.1"],
    ["non-numeric", "3.x.0"],
    ["a number", 3],
    ["null", null],
    ["undefined", undefined],
    ["empty", ""],
  ])("rejects %s", (_label, input) => {
    expect(parseVersion(input)).toBeNull();
  });
});

describe("canImport", () => {
  it("accepts what this build writes", () => {
    expect(canImport(exportDataVersion)).toMatchObject({ supported: true });
  });

  it("accepts any patch of the supported minor", () => {
    expect(canImport("3.0.99")).toMatchObject({ supported: true });
  });

  it("refuses a newer minor rather than guessing at it", () => {
    // The writer added something this build cannot carry; parsing it anyway
    // would silently drop that data on the next save.
    expect(canImport("3.1.0")).toEqual({
      supported: false,
      reason: "tooNew",
    });
  });

  it("refuses a newer major", () => {
    expect(canImport("4.0.0")).toEqual({ supported: false, reason: "tooNew" });
  });

  it("refuses an older major", () => {
    expect(canImport("2.0.0")).toEqual({ supported: false, reason: "tooOld" });
  });

  it("refuses something unparseable", () => {
    expect(canImport("banana")).toEqual({
      supported: false,
      reason: "unparseable",
    });
  });
});

describe("validateExportData", () => {
  describe("a well-formed file", () => {
    it("is accepted", () => {
      const result = validateExportData(validFile());

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
    });

    it("comes back with its lists and patterns intact", () => {
      const result = validateExportData(validFile());

      expect(result.data!.patternLists).toHaveLength(1);
      expect(result.data!.patternLists[0].patterns).toHaveLength(1);
    });

    it("preserves the readonly and shareCode flags", () => {
      const result = validateExportData(
        fileWithList(baseList({ readonly: true, shareCode: "ABCD1234" })),
      );

      expect(result.data!.patternLists[0]).toMatchObject({
        readonly: true,
        shareCode: "ABCD1234",
      });
    });
  });

  describe("files that are rejected outright", () => {
    it.each([
      ["null", null],
      ["a string", "not a file"],
      ["a number", 42],
      ["an array", []],
    ])("refuses %s", (_label, input) => {
      const result = validateExportData(input);

      expect(result.valid).toBe(false);
      expect(result.errors).not.toEqual([]);
    });

    it("refuses a file with no version", () => {
      const { version: _v, ...rest } = validFile();

      expect(validateExportData(rest).valid).toBe(false);
    });

    it("explains that a newer file needs a newer app", () => {
      const result = validateExportData(validFile({ version: "4.0.0" }));

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatch(/newer version of the app/);
    });

    it("refuses a file whose patternLists is not a list", () => {
      expect(
        validateExportData(validFile({ patternLists: "nope" })).valid,
      ).toBe(false);
    });

    it("refuses a list with no id", () => {
      const { id: _id, ...rest } = baseList();

      const result = validateExportData(fileWithList(rest));

      expect(result.valid).toBe(false);
      expect(result.errors.join(" ")).toMatch(/no id/);
    });

    it("refuses two lists sharing an id", () => {
      const shared = baseList();
      const result = validateExportData(
        validFile({ patternLists: [shared, { ...shared, name: "Copy" }] }),
      );

      expect(result.valid).toBe(false);
      expect(result.errors.join(" ")).toMatch(/share the id/);
    });

    it("refuses a pattern whose id is not a number", () => {
      const result = validateExportData(
        fileWithList(
          baseList({
            patterns: [{ ...createTestPattern(TYPE.id, { id: 1 }), id: "one" }],
          }),
        ),
      );

      expect(result.valid).toBe(false);
      expect(result.errors.join(" ")).toMatch(/no usable id/);
    });

    it("refuses a pattern whose id is fractional", () => {
      const result = validateExportData(
        fileWithList(
          baseList({
            patterns: [{ ...createTestPattern(TYPE.id, { id: 1 }), id: 1.5 }],
          }),
        ),
      );

      expect(result.valid).toBe(false);
    });

    it("refuses two patterns sharing an id", () => {
      const result = validateExportData(
        fileWithList(
          baseList({
            patterns: [
              createTestPattern(TYPE.id, { id: 1, name: "A" }),
              createTestPattern(TYPE.id, { id: 1, name: "B" }),
            ],
          }),
        ),
      );

      expect(result.valid).toBe(false);
      expect(result.errors.join(" ")).toMatch(/share the id 1/);
    });

    it("refuses patterns that are not a list", () => {
      expect(
        validateExportData(fileWithList(baseList({ patterns: "nope" }))).valid,
      ).toBe(false);
    });

    it("imports nothing at all when one list is unusable", () => {
      // Half an import is worse than none: the user cannot tell what landed.
      const result = validateExportData(
        validFile({
          patternLists: [baseList(), { name: "no id here" }],
        }),
      );

      expect(result.valid).toBe(false);
      expect(result.data).toBeUndefined();
    });
  });

  describe("problems that are repaired rather than rejected", () => {
    it("drops a prerequisite that matches no pattern in the file", () => {
      const result = validateExportData(
        fileWithList(
          baseList({
            patterns: [
              createTestPattern(TYPE.id, { id: 2, prerequisites: [99] }),
            ],
          }),
        ),
      );

      expect(result.valid).toBe(true);
      expect(result.data!.patternLists[0].patterns[0].prerequisites).toEqual(
        [],
      );
      expect(result.warnings.join(" ")).toMatch(/prerequisite/);
    });

    it("drops a self-referencing prerequisite", () => {
      const result = validateExportData(
        fileWithList(
          baseList({
            patterns: [
              createTestPattern(TYPE.id, { id: 1, prerequisites: [1] }),
            ],
          }),
        ),
      );

      expect(result.data!.patternLists[0].patterns[0].prerequisites).toEqual(
        [],
      );
    });

    it("keeps the prerequisites that do resolve", () => {
      const result = validateExportData(
        fileWithList(
          baseList({
            patterns: [
              createTestPattern(TYPE.id, { id: 1 }),
              createTestPattern(TYPE.id, { id: 2, prerequisites: [1, 99] }),
            ],
          }),
        ),
      );

      expect(result.data!.patternLists[0].patterns[1].prerequisites).toEqual([
        1,
      ]);
    });

    it("reassigns a pattern whose type is not in its list", () => {
      const result = validateExportData(
        fileWithList(
          baseList({
            patterns: [createTestPattern("ghost-type", { id: 1 })],
          }),
        ),
      );

      expect(result.valid).toBe(true);
      expect(result.data!.patternLists[0].patterns[0].typeId).toBe(TYPE.id);
      expect(result.warnings.join(" ")).toMatch(
        /pattern type is not in the list/,
      );
    });

    it("drops an attachment to a modifier that is not in the list", () => {
      const result = validateExportData(
        fileWithList(
          baseList({
            patterns: [
              createTestPattern(TYPE.id, {
                id: 1,
                modifierRefs: [{ modifierId: "ghost", videoRefs: [] }],
              }),
            ],
          }),
        ),
      );

      expect(result.valid).toBe(true);
      expect(result.data!.patternLists[0].patterns[0].modifierRefs).toEqual([]);
    });

    it("keeps an attachment to a modifier that is in the list", () => {
      const modifierId = generateUUID();
      const result = validateExportData(
        fileWithList(
          baseList({
            modifiers: [
              {
                id: modifierId,
                name: "with a spin",
                position: "postfix",
                universal: false,
                videoRefs: [],
              },
            ],
            patterns: [
              createTestPattern(TYPE.id, {
                id: 1,
                modifierRefs: [{ modifierId, videoRefs: [] }],
              }),
            ],
          }),
        ),
      );

      expect(
        result.data!.patternLists[0].patterns[0].modifierRefs[0].modifierId,
      ).toBe(modifierId);
    });

    it("drops a malformed video reference but keeps the good ones", () => {
      const result = validateExportData(
        fileWithList(
          baseList({
            patterns: [
              {
                ...createTestPattern(TYPE.id, { id: 1 }),
                videoRefs: [
                  { type: "url", value: "https://example.com/a.mp4" },
                  { type: "telepathy", value: "x" },
                  { type: "local" },
                  "not even an object",
                ],
              },
            ],
          }),
        ),
      );

      expect(result.data!.patternLists[0].patterns[0].videoRefs).toEqual([
        { type: "url", value: "https://example.com/a.mp4" },
      ]);
    });

    it("drops a non-numeric start time without dropping the video", () => {
      const result = validateExportData(
        fileWithList(
          baseList({
            patterns: [
              {
                ...createTestPattern(TYPE.id, { id: 1 }),
                videoRefs: [
                  { type: "url", value: "https://x/a.mp4", startTime: "soon" },
                ],
              },
            ],
          }),
        ),
      );

      const [video] = result.data!.patternLists[0].patterns[0].videoRefs;
      expect(video.value).toBe("https://x/a.mp4");
      expect(video.startTime).toBeUndefined();
    });

    it("defaults an unknown modifier position rather than rejecting it", () => {
      const result = validateExportData(
        fileWithList(
          baseList({
            modifiers: [
              {
                id: generateUUID(),
                name: "odd",
                position: "sideways",
                universal: false,
                videoRefs: [],
              },
            ],
          }),
        ),
      );

      expect(result.data!.patternLists[0].modifiers[0].position).toBe("amends");
    });

    it("fills in missing optional fields", () => {
      const result = validateExportData(
        fileWithList({
          id: generateUUID(),
          patternTypes: [TYPE],
          patterns: [{ id: 1, typeId: TYPE.id }],
        }),
      );

      const [pattern] = result.data!.patternLists[0].patterns;
      expect(pattern).toMatchObject({
        name: "",
        counts: 0,
        description: "",
        tags: [],
        videoRefs: [],
        modifierRefs: [],
        prerequisites: [],
      });
      expect(result.data!.patternLists[0].modifiers).toEqual([]);
    });

    it("drops duplicate pattern types", () => {
      const result = validateExportData(
        fileWithList(baseList({ patternTypes: [TYPE, TYPE] })),
      );

      expect(result.data!.patternLists[0].patternTypes).toHaveLength(1);
    });

    it("ignores video data that is not a string", () => {
      const result = validateExportData(
        validFile({ videos: { "a.mp4": 42, "b.mp4": "base64==" } }),
      );

      expect(result.data!.videos).toEqual({ "b.mp4": "base64==" });
      expect(result.warnings.join(" ")).toMatch(/a\.mp4/);
    });
  });

  describe("hostile input", () => {
    it("survives deeply nested nonsense in place of a list", () => {
      let nested: unknown = "bottom";
      for (let i = 0; i < 200; i++) nested = { next: nested };

      const result = validateExportData(validFile({ patternLists: [nested] }));

      expect(result.valid).toBe(false);
    });

    it("survives a pattern whose fields are all the wrong type", () => {
      const result = validateExportData(
        fileWithList(
          baseList({
            patterns: [
              {
                id: 1,
                name: 42,
                typeId: [],
                counts: "eight",
                prerequisites: "none",
                description: {},
                tags: "basic",
                videoRefs: 7,
                modifierRefs: false,
              },
            ],
          }),
        ),
      );

      expect(result.valid).toBe(true);
      expect(result.data!.patternLists[0].patterns[0]).toMatchObject({
        name: "",
        counts: 0,
        description: "",
        tags: [],
        prerequisites: [],
        videoRefs: [],
        modifierRefs: [],
      });
    });

    it("does not choke on a large file", () => {
      const patterns = Array.from({ length: 2000 }, (_, i) =>
        createTestPattern(TYPE.id, { id: i + 1 }),
      );

      const result = validateExportData(fileWithList(baseList({ patterns })));

      expect(result.valid).toBe(true);
      expect(result.data!.patternLists[0].patterns).toHaveLength(2000);
    });
  });
});
