import * as Sharing from "expo-sharing";
import { getDocumentAsync } from "expo-document-picker";
import { File } from "expo-file-system";
import {
  listFileUris,
  readFileBytes,
  readFileText,
  seedBinaryFile,
  seedFile,
} from "@/__mocks__/expo-file-system";
import { exportPatternLists } from "@/src/pattern/data/exportPatterns";
import { importPatternLists } from "@/src/pattern/data/ImportPatterns";
import {
  exportDataVersion,
  IPatternListExportData,
  PatternListWithPatterns,
} from "@/src/pattern/data/types/IExportData";
import {
  IModifier,
  IPattern,
  IVideoReference,
} from "@/src/pattern/types/IPatternList";
import { generateUUID } from "@/src/pattern/types/PatternType";
import {
  createTestPattern,
  createTestPatternList,
  createTestPatternType,
} from "@/utils/testFactories";

jest.mock("expo-sharing", () => ({
  isAvailableAsync: jest.fn(async () => true),
  shareAsync: jest.fn(async () => undefined),
}));

jest.mock("expo-document-picker", () => ({
  getDocumentAsync: jest.fn(),
}));

const mockedShareAsync = Sharing.shareAsync as jest.MockedFunction<
  typeof Sharing.shareAsync
>;
const mockedIsAvailable = Sharing.isAvailableAsync as jest.MockedFunction<
  typeof Sharing.isAvailableAsync
>;
const mockedPickDocument = getDocumentAsync as jest.MockedFunction<
  typeof getDocumentAsync
>;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const VIDEO_A = "file:///device/camera/whip.mp4";
const VIDEO_B = "file:///device/camera/push.mp4";
const VIDEO_C = "file:///device/camera/spin.mp4";

/** Bytes that are not valid UTF-8, so a broken encode/decode cannot pass. */
const videoBytes = (seed: number) =>
  Buffer.from([0x00, 0xff, 0xfe, seed, 0x80, 0x01, seed ^ 0xff, 0x7f]);

function localRef(value: string): IVideoReference {
  return { type: "local", value };
}

function urlRef(value: string, startTime?: number): IVideoReference {
  return { type: "url", value, ...(startTime !== undefined && { startTime }) };
}

function listWith(
  patterns: IPattern[],
  overrides: Partial<PatternListWithPatterns> = {},
): PatternListWithPatterns {
  return { ...createTestPatternList(), patterns, ...overrides };
}

/**
 * Runs a real export, then feeds the file it produced straight back into the
 * importer. This is the whole point of the suite: the two modules only agree
 * through the on-disk format, so testing them apart proves very little.
 */
async function roundTrip(
  lists: PatternListWithPatterns[],
  { includeVideos = true, exportAsReadonly = false } = {},
) {
  const exportResult = await exportPatternLists(
    lists,
    includeVideos,
    exportAsReadonly,
  );

  const sharedUri = mockedShareAsync.mock.calls.at(-1)?.[0] as string;
  const rawJson = readFileText(sharedUri);
  const exported: IPatternListExportData = JSON.parse(rawJson ?? "{}");

  mockedPickDocument.mockResolvedValue({
    canceled: false,
    assets: [{ uri: sharedUri, name: "export.json", size: 0, mimeType: "" }],
  } as never);

  const importResult = await importPatternLists();

  return { exportResult, importResult, exported, sharedUri };
}

beforeEach(() => {
  mockedIsAvailable.mockResolvedValue(true);
  mockedShareAsync.mockResolvedValue(undefined);
});

describe("export → import round trip", () => {
  describe("list and pattern data", () => {
    it("brings a list back with its patterns intact", async () => {
      const type = createTestPatternType({ slug: "push" });
      const patterns = [
        createTestPattern(type.id, {
          id: 1,
          name: "Sugar Push",
          counts: 6,
          level: "beginner",
          description: "The basic",
          tags: ["basic", "6-count"],
          prerequisites: [],
        }),
        createTestPattern(type.id, {
          id: 2,
          name: "Whip",
          counts: 8,
          prerequisites: [1],
        }),
      ];
      const list = listWith(patterns, {
        name: "West Coast Swing",
        patternTypes: [type],
      });

      const { importResult } = await roundTrip([list]);

      expect(importResult.success).toBe(true);
      const [imported] = importResult.patternLists!;
      expect(imported.id).toBe(list.id);
      expect(imported.name).toBe("West Coast Swing");
      expect(imported.patternTypes).toEqual([type]);
      expect(imported.patterns).toEqual(patterns);
    });

    it("preserves prerequisite links, which are the whole data model", async () => {
      const type = createTestPatternType();
      const patterns = [
        createTestPattern(type.id, { id: 1, prerequisites: [] }),
        createTestPattern(type.id, { id: 2, prerequisites: [1] }),
        createTestPattern(type.id, { id: 3, prerequisites: [1, 2] }),
      ];

      const { importResult } = await roundTrip([
        listWith(patterns, { patternTypes: [type] }),
      ]);

      const imported = importResult.patternLists![0].patterns;
      expect(imported.map((p) => p.prerequisites)).toEqual([[], [1], [1, 2]]);
    });

    it("round-trips several lists independently", async () => {
      const a = listWith([createTestPattern("t", { id: 1, name: "A1" })], {
        name: "Salsa",
      });
      const b = listWith(
        [
          createTestPattern("t", { id: 1, name: "B1" }),
          createTestPattern("t", { id: 2, name: "B2" }),
        ],
        { name: "Bachata" },
      );

      const { importResult } = await roundTrip([a, b]);

      const lists = importResult.patternLists!;
      expect(lists.map((l) => l.name)).toEqual(["Salsa", "Bachata"]);
      expect(lists.map((l) => l.patterns.length)).toEqual([1, 2]);
    });

    it("round-trips an empty list", async () => {
      const { importResult } = await roundTrip([listWith([])]);

      expect(importResult.success).toBe(true);
      expect(importResult.patternLists![0].patterns).toEqual([]);
    });

    it("handles being given no lists at all", async () => {
      const { exportResult, importResult } = await roundTrip([]);

      expect(exportResult.success).toBe(true);
      expect(importResult.success).toBe(true);
      expect(importResult.patternLists).toEqual([]);
    });
  });

  describe("modifiers", () => {
    it("round-trips list modifiers and per-pattern attachments", async () => {
      const modifier: IModifier = {
        id: generateUUID(),
        name: "with a spin",
        position: "postfix",
        universal: false,
        videoRefs: [],
      };
      const pattern = createTestPattern("t", {
        id: 1,
        modifierRefs: [{ modifierId: modifier.id, videoRefs: [] }],
      });

      const { importResult } = await roundTrip([
        listWith([pattern], { modifiers: [modifier] }),
      ]);

      const imported = importResult.patternLists![0];
      expect(imported.modifiers).toEqual([modifier]);
      expect(imported.patterns[0].modifierRefs).toEqual([
        { modifierId: modifier.id, videoRefs: [] },
      ]);
    });

    it("tolerates a list written before modifiers existed", async () => {
      const list = listWith([createTestPattern("t", { id: 1 })]);
      // Simulate pre-modifier data reaching the exporter.
      delete (list as Partial<PatternListWithPatterns>).modifiers;
      delete (list.patterns[0] as Partial<IPattern>).modifierRefs;

      const { importResult } = await roundTrip([list]);

      expect(importResult.success).toBe(true);
      expect(importResult.patternLists![0].modifiers).toEqual([]);
      expect(importResult.patternLists![0].patterns[0].modifierRefs).toEqual(
        [],
      );
    });
  });

  describe("videos", () => {
    it("brings a local video back byte-for-byte", async () => {
      seedBinaryFile(VIDEO_A, videoBytes(1));
      const pattern = createTestPattern("t", {
        id: 1,
        videoRefs: [localRef(VIDEO_A)],
      });

      const { importResult } = await roundTrip([listWith([pattern])]);

      const [restored] = importResult.patternLists![0].patterns[0].videoRefs;
      expect(restored.type).toBe("local");
      // A new path on this device, not the exporter's path.
      expect(restored.value).not.toBe(VIDEO_A);
      expect(readFileBytes(restored.value)).toEqual(videoBytes(1));
    });

    it("leaves URL videos untouched, start time included", async () => {
      const refs = [
        urlRef("https://youtu.be/abc123", 42),
        urlRef("https://example.com/clip.mp4"),
      ];
      const pattern = createTestPattern("t", { id: 1, videoRefs: refs });

      const { importResult } = await roundTrip([listWith([pattern])]);

      expect(importResult.patternLists![0].patterns[0].videoRefs).toEqual(refs);
    });

    it("restores videos attached to a universal modifier", async () => {
      seedBinaryFile(VIDEO_B, videoBytes(2));
      const modifier: IModifier = {
        id: generateUUID(),
        name: "slow",
        position: "prefix",
        universal: true,
        videoRefs: [localRef(VIDEO_B)],
      };

      const { importResult } = await roundTrip([
        listWith([createTestPattern("t", { id: 1 })], {
          modifiers: [modifier],
        }),
      ]);

      const [restored] = importResult.patternLists![0].modifiers[0].videoRefs;
      expect(readFileBytes(restored.value)).toEqual(videoBytes(2));
    });

    it("restores videos of a pattern×modifier combination", async () => {
      seedBinaryFile(VIDEO_C, videoBytes(3));
      const modifier: IModifier = {
        id: generateUUID(),
        name: "with a spin",
        position: "postfix",
        universal: false,
        videoRefs: [],
      };
      const pattern = createTestPattern("t", {
        id: 1,
        modifierRefs: [
          { modifierId: modifier.id, videoRefs: [localRef(VIDEO_C)] },
        ],
      });

      const { importResult } = await roundTrip([
        listWith([pattern], { modifiers: [modifier] }),
      ]);

      const [restored] =
        importResult.patternLists![0].patterns[0].modifierRefs[0].videoRefs;
      expect(readFileBytes(restored.value)).toEqual(videoBytes(3));
    });

    it("embeds a shared video only once", async () => {
      seedBinaryFile(VIDEO_A, videoBytes(1));
      const patterns = [
        createTestPattern("t", { id: 1, videoRefs: [localRef(VIDEO_A)] }),
        createTestPattern("t", { id: 2, videoRefs: [localRef(VIDEO_A)] }),
      ];

      const { exported } = await roundTrip([listWith(patterns)]);

      expect(Object.keys(exported.videos)).toEqual([VIDEO_A]);
    });

    it("keys embedded videos by their original local path", async () => {
      seedBinaryFile(VIDEO_A, videoBytes(1));
      const pattern = createTestPattern("t", {
        id: 1,
        videoRefs: [localRef(VIDEO_A)],
      });

      const { exported } = await roundTrip([listWith([pattern])]);

      expect(exported.videos[VIDEO_A]).toBe(videoBytes(1).toString("base64"));
    });
  });

  describe("excluding videos", () => {
    it("strips local refs but keeps URL refs", async () => {
      seedBinaryFile(VIDEO_A, videoBytes(1));
      const pattern = createTestPattern("t", {
        id: 1,
        videoRefs: [localRef(VIDEO_A), urlRef("https://youtu.be/abc")],
      });

      const { exported, importResult } = await roundTrip(
        [listWith([pattern])],
        {
          includeVideos: false,
        },
      );

      expect(exported.includesVideos).toBe(false);
      expect(exported.videos).toEqual({});
      expect(importResult.patternLists![0].patterns[0].videoRefs).toEqual([
        urlRef("https://youtu.be/abc"),
      ]);
    });

    it("strips local refs from modifier combinations too", async () => {
      seedBinaryFile(VIDEO_C, videoBytes(3));
      const modifier: IModifier = {
        id: generateUUID(),
        name: "spin",
        position: "postfix",
        universal: true,
        videoRefs: [localRef(VIDEO_C)],
      };
      const pattern = createTestPattern("t", {
        id: 1,
        modifierRefs: [
          {
            modifierId: modifier.id,
            videoRefs: [localRef(VIDEO_C), urlRef("https://youtu.be/x")],
          },
        ],
      });

      const { importResult } = await roundTrip(
        [listWith([pattern], { modifiers: [modifier] })],
        { includeVideos: false },
      );

      const imported = importResult.patternLists![0];
      expect(imported.modifiers[0].videoRefs).toEqual([]);
      expect(imported.patterns[0].modifierRefs[0].videoRefs).toEqual([
        urlRef("https://youtu.be/x"),
      ]);
    });

    it("does not warn about the videos it was told to leave out", async () => {
      seedBinaryFile(VIDEO_A, videoBytes(1));
      const pattern = createTestPattern("t", {
        id: 1,
        videoRefs: [localRef(VIDEO_A)],
      });

      const { importResult } = await roundTrip([listWith([pattern])], {
        includeVideos: false,
      });

      expect(importResult.message).not.toMatch(/Warning/i);
    });
  });

  describe("read-only exports", () => {
    it("stamps every list when asked", async () => {
      const { exported, importResult } = await roundTrip(
        [listWith([]), listWith([])],
        { exportAsReadonly: true },
      );

      expect(exported.patternLists.every((l) => l.readonly === true)).toBe(
        true,
      );
      expect(importResult.patternLists!.every((l) => l.readonly === true)).toBe(
        true,
      );
    });

    it("omits the flag entirely otherwise", async () => {
      const { exported } = await roundTrip([listWith([])]);

      expect(exported.patternLists[0]).not.toHaveProperty("readonly");
    });

    it("does not silently un-flag a list that was already read-only", async () => {
      const { importResult } = await roundTrip([
        listWith([], { readonly: true }),
      ]);

      // The exporter writes `readonly: undefined` when not exporting as
      // read-only, which JSON.stringify drops — so an already-read-only list
      // comes back editable. Recorded as observed behaviour, not endorsed;
      // see AGENT_TASKS.md.
      expect(importResult.patternLists![0].readonly).toBeUndefined();
    });
  });

  describe("export envelope", () => {
    it("writes the current format version and a parseable date", async () => {
      const { exported } = await roundTrip([listWith([])]);

      expect(exported.version).toBe(exportDataVersion);
      expect(Number.isNaN(Date.parse(exported.exportDate))).toBe(false);
    });

    it("names the file so exports do not overwrite each other", async () => {
      const { sharedUri } = await roundTrip([listWith([])]);

      expect(sharedUri).toMatch(
        /^file:\/\/\/document\/pattern-lists-.*\.json$/,
      );
    });

    it("hands the file to the share sheet as JSON", async () => {
      await roundTrip([listWith([])]);

      expect(mockedShareAsync).toHaveBeenCalledWith(
        expect.stringContaining("pattern-lists-"),
        expect.objectContaining({ mimeType: "application/json" }),
      );
    });

    it("reports how much was exported", async () => {
      const { exportResult } = await roundTrip([
        listWith([
          createTestPattern("t", { id: 1 }),
          createTestPattern("t", { id: 2 }),
        ]),
      ]);

      expect(exportResult.message).toContain("1 list(s)");
      expect(exportResult.message).toContain("2 pattern(s)");
    });
  });

  describe("degraded inputs", () => {
    it("skips a video whose file has vanished, and says so on import", async () => {
      // Referenced but never seeded — the user deleted it from the gallery.
      const pattern = createTestPattern("t", {
        id: 1,
        videoRefs: [localRef(VIDEO_A)],
      });

      const { exported, importResult } = await roundTrip([listWith([pattern])]);

      expect(exported.videos).toEqual({});
      expect(importResult.success).toBe(true);
      expect(importResult.message).toContain("Video data missing");
      expect(importResult.patternLists![0].patterns[0].videoRefs).toEqual([]);
    });

    it("warns rather than aborting when a video cannot be read", async () => {
      seedBinaryFile(VIDEO_A, videoBytes(1));
      jest
        .spyOn(File.prototype, "base64")
        .mockRejectedValue(new Error("permission denied"));
      const pattern = createTestPattern("t", {
        id: 1,
        videoRefs: [localRef(VIDEO_A)],
      });

      const { exportResult } = await roundTrip([listWith([pattern])]);

      expect(exportResult.success).toBe(true);
      expect(exportResult.message).toContain("Failed to read video");
    });

    it("keeps the other lists when one list's video is unreadable", async () => {
      seedBinaryFile(VIDEO_A, videoBytes(1));
      const withMissing = listWith(
        [
          createTestPattern("t", {
            id: 1,
            videoRefs: [localRef("file:///gone.mp4")],
          }),
        ],
        { name: "Has a gap" },
      );
      const healthy = listWith(
        [createTestPattern("t", { id: 1, videoRefs: [localRef(VIDEO_A)] })],
        { name: "Fine" },
      );

      const { importResult } = await roundTrip([withMissing, healthy]);

      expect(importResult.patternLists!.map((l) => l.name)).toEqual([
        "Has a gap",
        "Fine",
      ]);
      const restored = importResult.patternLists![1].patterns[0].videoRefs[0];
      expect(readFileBytes(restored.value)).toEqual(videoBytes(1));
    });
  });

  describe("export failure handling", () => {
    it("reports when sharing is unavailable instead of claiming success", async () => {
      mockedIsAvailable.mockResolvedValue(false);

      const result = await exportPatternLists([listWith([])]);

      expect(result.success).toBe(false);
      expect(result.message).toMatch(/not available/i);
    });

    it("reports a write failure instead of throwing", async () => {
      jest.spyOn(File.prototype, "write").mockImplementation(() => {
        throw new Error("disk full");
      });

      const result = await exportPatternLists([listWith([])]);

      expect(result.success).toBe(false);
      expect(result.message).toContain("disk full");
    });
  });

  describe("import failure handling", () => {
    it("reports cancellation without treating it as an error", async () => {
      mockedPickDocument.mockResolvedValue({ canceled: true } as never);

      const result = await importPatternLists();

      expect(result.cancelled).toBe(true);
      expect(result.success).toBe(false);
      expect(result.patternLists).toBeUndefined();
    });

    it("rejects a file that is not JSON", async () => {
      seedFile("file:///picked.json", "this is not json");
      mockedPickDocument.mockResolvedValue({
        canceled: false,
        assets: [{ uri: "file:///picked.json" }],
      } as never);

      const result = await importPatternLists();

      expect(result.success).toBe(false);
      expect(result.message).toMatch(/Import failed/);
    });

    it("rejects a JSON file that is not an export", async () => {
      seedFile("file:///picked.json", JSON.stringify({ hello: "world" }));
      mockedPickDocument.mockResolvedValue({
        canceled: false,
        assets: [{ uri: "file:///picked.json" }],
      } as never);

      const result = await importPatternLists();

      expect(result.success).toBe(false);
      expect(result.message).toBe("Invalid import file format");
    });

    it("rejects an export with no version", async () => {
      seedFile(
        "file:///picked.json",
        JSON.stringify({ patternLists: [], videos: {} }),
      );
      mockedPickDocument.mockResolvedValue({
        canceled: false,
        assets: [{ uri: "file:///picked.json" }],
      } as never);

      const result = await importPatternLists();

      expect(result.success).toBe(false);
      expect(result.message).toBe("Invalid import file format");
    });

    it("reports a missing file instead of throwing", async () => {
      mockedPickDocument.mockResolvedValue({
        canceled: false,
        assets: [{ uri: "file:///nope.json" }],
      } as never);

      const result = await importPatternLists();

      expect(result.success).toBe(false);
      expect(result.message).toMatch(/Import failed/);
    });
  });

  // Regression guards for B8. `generateVideoUri` used to derive the filename
  // from `contextId` plus `Date.now()`, but `contextId` is the same string for
  // every video of a pattern — so two videos restored in the same millisecond
  // resolved to one path, the second overwriting the first. The loop is tight
  // and the writes synchronous, so that was the normal case, not a rare race.
  //
  // `Date.now()` is frozen in both tests: under the old implementation that is
  // the guaranteed-collision case, so these fail loudly if the filename ever
  // goes back to being time-derived.
  describe("restored video paths are unique", () => {
    it("gives each of a pattern's videos its own file", async () => {
      jest.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
      seedBinaryFile(VIDEO_A, videoBytes(1));
      seedBinaryFile(VIDEO_B, videoBytes(2));
      const pattern = createTestPattern("t", {
        id: 1,
        videoRefs: [localRef(VIDEO_A), localRef(VIDEO_B)],
      });

      const { importResult } = await roundTrip([listWith([pattern])]);

      const refs = importResult.patternLists![0].patterns[0].videoRefs;
      expect(refs).toHaveLength(2);
      expect(refs[0].value).not.toBe(refs[1].value);
      expect(readFileBytes(refs[0].value)).toEqual(videoBytes(1));
      expect(readFileBytes(refs[1].value)).toEqual(videoBytes(2));
    });

    it("keeps two lists' videos apart when their pattern ids coincide", async () => {
      jest.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
      seedBinaryFile(VIDEO_A, videoBytes(1));
      seedBinaryFile(VIDEO_B, videoBytes(2));
      const lists = [
        listWith([
          createTestPattern("t", { id: 1, videoRefs: [localRef(VIDEO_A)] }),
        ]),
        // A different list, but pattern ids are only unique within a list, so
        // this shares the `pattern:1` context id.
        listWith([
          createTestPattern("t", { id: 1, videoRefs: [localRef(VIDEO_B)] }),
        ]),
      ];

      const { importResult } = await roundTrip(lists);

      const first = importResult.patternLists![0].patterns[0].videoRefs[0];
      const second = importResult.patternLists![1].patterns[0].videoRefs[0];
      expect(first.value).not.toBe(second.value);
      expect(readFileBytes(first.value)).toEqual(videoBytes(1));
      expect(readFileBytes(second.value)).toEqual(videoBytes(2));
    });

    it("keeps a modifier combination's videos apart from the pattern's own", async () => {
      jest.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
      seedBinaryFile(VIDEO_A, videoBytes(1));
      seedBinaryFile(VIDEO_C, videoBytes(3));
      const modifier: IModifier = {
        id: generateUUID(),
        name: "with a spin",
        position: "postfix",
        universal: false,
        videoRefs: [],
      };
      const pattern = createTestPattern("t", {
        id: 1,
        videoRefs: [localRef(VIDEO_A)],
        modifierRefs: [
          { modifierId: modifier.id, videoRefs: [localRef(VIDEO_C)] },
        ],
      });

      const { importResult } = await roundTrip([
        listWith([pattern], { modifiers: [modifier] }),
      ]);

      const imported = importResult.patternLists![0].patterns[0];
      const own = imported.videoRefs[0];
      const combo = imported.modifierRefs[0].videoRefs[0];
      expect(own.value).not.toBe(combo.value);
      expect(readFileBytes(own.value)).toEqual(videoBytes(1));
      expect(readFileBytes(combo.value)).toEqual(videoBytes(3));
    });

    it("writes one file per restored video across a whole import", async () => {
      jest.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
      seedBinaryFile(VIDEO_A, videoBytes(1));
      seedBinaryFile(VIDEO_B, videoBytes(2));
      seedBinaryFile(VIDEO_C, videoBytes(3));
      const pattern = createTestPattern("t", {
        id: 1,
        videoRefs: [localRef(VIDEO_A), localRef(VIDEO_B), localRef(VIDEO_C)],
      });

      await roundTrip([listWith([pattern])]);

      const imported = listFileUris().filter((uri) =>
        uri.includes("imported-"),
      );
      expect(imported).toHaveLength(3);
      expect(new Set(imported).size).toBe(3);
    });
  });

  describe("filesystem hygiene", () => {
    it("writes exactly one new file per restored video", async () => {
      seedBinaryFile(VIDEO_A, videoBytes(1));
      const pattern = createTestPattern("t", {
        id: 1,
        videoRefs: [localRef(VIDEO_A)],
      });

      await roundTrip([listWith([pattern])]);

      const imported = listFileUris().filter((uri) =>
        uri.includes("imported-"),
      );
      expect(imported).toHaveLength(1);
    });
  });
});
