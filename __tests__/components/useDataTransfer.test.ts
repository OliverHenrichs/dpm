import AsyncStorage from "@react-native-async-storage/async-storage";
import { seedAsyncStorage } from "@/__mocks__/@react-native-async-storage/async-storage";
import { exportPatternLists } from "@/src/pattern/data/exportPatterns";
import { importPatternLists } from "@/src/pattern/data/ImportPatterns";
import { useDataTransfer } from "@/src/settings/hooks/useDataTransfer";
import { ImportDecision } from "@/src/pattern/data/hooks/useImportDecisions";
import { PatternListWithPatterns } from "@/src/pattern/data/types/IExportData";
import { IPattern, IPatternList } from "@/src/pattern/types/IPatternList";
import {
  createTestPattern,
  createTestPatternList,
} from "@/utils/testFactories";
import {
  act,
  renderHookWithProviders,
  waitFor,
} from "@/utils/renderWithProviders";

jest.mock("@/src/pattern/data/exportPatterns", () => ({
  exportPatternLists: jest.fn(),
}));
jest.mock("@/src/pattern/data/ImportPatterns", () => ({
  importPatternLists: jest.fn(),
}));

const mockedExport = exportPatternLists as jest.MockedFunction<
  typeof exportPatternLists
>;
const mockedImport = importPatternLists as jest.MockedFunction<
  typeof importPatternLists
>;

beforeEach(() => {
  mockedExport.mockResolvedValue({ success: true, message: "ok" });
  mockedImport.mockResolvedValue({ success: true, message: "ok" });
});

const importable = (
  overrides: Partial<PatternListWithPatterns> = {},
): PatternListWithPatterns => ({
  ...createTestPatternList(),
  patterns: [],
  ...overrides,
});

const decision = (
  list: PatternListWithPatterns,
  action: "skip" | "replace",
): ImportDecision => ({ list, action });

const storedLists = async (): Promise<IPatternList[]> =>
  JSON.parse((await AsyncStorage.getItem("@patternLists")) ?? "[]");

const storedPatterns = async (listId: string): Promise<IPattern[]> =>
  JSON.parse((await AsyncStorage.getItem(`@patterns_${listId}`)) ?? "[]");

/** Mount the hook and wait for its focus-effect load to settle. */
async function mount(seed: { lists?: IPatternList[] } = {}) {
  if (seed.lists?.length) {
    seedAsyncStorage({ "@patternLists": JSON.stringify(seed.lists) });
  }
  const view = renderHookWithProviders(() => useDataTransfer());
  await waitFor(() =>
    expect(view.result.current.patternLists).toHaveLength(
      seed.lists?.length ?? 0,
    ),
  );
  return view;
}

describe("useDataTransfer", () => {
  describe("loading", () => {
    it("pairs each list with its patterns", async () => {
      const list = createTestPatternList();
      seedAsyncStorage({
        "@patternLists": JSON.stringify([list]),
        [`@patterns_${list.id}`]: JSON.stringify([
          createTestPattern("t", { id: 1 }),
        ]),
      });
      const { result } = renderHookWithProviders(() => useDataTransfer());

      await waitFor(() =>
        expect(result.current.patternLists[0]?.patterns).toHaveLength(1),
      );
    });
  });

  describe("export", () => {
    it("refuses to open the picker with nothing to export", async () => {
      const { result } = await mount();

      act(() => result.current.handleExportButtonPress());

      expect(result.current.showExportModal).toBe(false);
      expect(result.current.dialog?.message).toBe("No pattern lists to export");
    });

    it("opens the picker when there is something to export", async () => {
      const { result } = await mount({ lists: [createTestPatternList()] });

      act(() => result.current.handleExportButtonPress());

      expect(result.current.showExportModal).toBe(true);
    });

    it("passes the options through and stays quiet on success", async () => {
      const { result } = await mount({ lists: [createTestPatternList()] });
      const selected = [importable()];

      await act(async () => {
        await result.current.handleExport(selected, false, true);
      });

      expect(mockedExport).toHaveBeenCalledWith(selected, false, true);
      expect(result.current.dialog).toBeNull();
      expect(result.current.showExportModal).toBe(false);
    });

    it("surfaces a reported failure", async () => {
      mockedExport.mockResolvedValue({ success: false, message: "no sharing" });
      const { result } = await mount();

      await act(async () => {
        await result.current.handleExport([], true, false);
      });

      expect(result.current.dialog?.message).toBe("no sharing");
    });

    it("surfaces a thrown failure instead of hanging", async () => {
      mockedExport.mockRejectedValue(new Error("disk full"));
      const { result } = await mount();

      await act(async () => {
        await result.current.handleExport([], true, false);
      });

      expect(result.current.dialog?.message).toContain("disk full");
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("picking an import file", () => {
    it("opens the decision modal with what was read", async () => {
      const incoming = importable();
      mockedImport.mockResolvedValue({
        success: true,
        message: "ok",
        patternLists: [incoming],
      });
      const { result } = await mount();

      await act(async () => {
        await result.current.handleImportButtonPress();
      });

      expect(result.current.showImportModal).toBe(true);
      expect(result.current.importedLists).toEqual([incoming]);
    });

    it("says nothing when the user cancels the file picker", async () => {
      mockedImport.mockResolvedValue({
        success: false,
        cancelled: true,
        message: "",
      });
      const { result } = await mount();

      await act(async () => {
        await result.current.handleImportButtonPress();
      });

      expect(result.current.showImportModal).toBe(false);
      expect(result.current.dialog).toBeNull();
    });

    it("reports an unreadable file", async () => {
      mockedImport.mockResolvedValue({
        success: false,
        message: "Invalid import file format",
      });
      const { result } = await mount();

      await act(async () => {
        await result.current.handleImportButtonPress();
      });

      expect(result.current.showImportModal).toBe(false);
      expect(result.current.dialog?.message).toBe("Invalid import file format");
    });
  });

  describe("applying import decisions", () => {
    it("writes a list marked replace", async () => {
      const incoming = importable({
        name: "Incoming",
        patterns: [createTestPattern("t", { id: 1, name: "Whip" })],
      });
      const { result } = await mount();

      await act(async () => {
        await result.current.handleImport([decision(incoming, "replace")]);
      });

      expect((await storedLists()).map((l) => l.name)).toEqual(["Incoming"]);
      expect((await storedPatterns(incoming.id)).map((p) => p.name)).toEqual([
        "Whip",
      ]);
    });

    it("leaves a list marked skip untouched", async () => {
      const existing = createTestPatternList({ name: "Local" });
      seedAsyncStorage({
        [`@patterns_${existing.id}`]: JSON.stringify([
          createTestPattern("t", { id: 1, name: "Mine" }),
        ]),
      });
      const incoming = importable({
        id: existing.id,
        name: "Incoming",
        patterns: [createTestPattern("t", { id: 9, name: "Theirs" })],
      });
      const { result } = await mount({ lists: [existing] });

      await act(async () => {
        await result.current.handleImport([decision(incoming, "skip")]);
      });

      expect((await storedLists()).map((l) => l.name)).toEqual(["Local"]);
      expect((await storedPatterns(existing.id)).map((p) => p.name)).toEqual([
        "Mine",
      ]);
    });

    it("applies each decision independently", async () => {
      const keep = createTestPatternList({ name: "Keep" });
      const skipped = importable({ id: keep.id, name: "Skipped" });
      const written = importable({ name: "Written" });
      const { result } = await mount({ lists: [keep] });

      await act(async () => {
        await result.current.handleImport([
          decision(skipped, "skip"),
          decision(written, "replace"),
        ]);
      });

      const names = (await storedLists()).map((l) => l.name).sort();
      expect(names).toEqual(["Keep", "Written"]);
    });

    it("reports what it did", async () => {
      const existing = createTestPatternList();
      const { result } = await mount({ lists: [existing] });

      await act(async () => {
        await result.current.handleImport([
          decision(importable({ id: existing.id }), "skip"),
          decision(importable(), "replace"),
          decision(importable(), "replace"),
        ]);
      });

      expect(result.current.dialog?.message).toBe(
        "Imported 2 list(s), skipped 1",
      );
    });

    it("refreshes the on-screen lists afterwards", async () => {
      const { result } = await mount();

      await act(async () => {
        await result.current.handleImport([
          decision(importable({ name: "Fresh" }), "replace"),
        ]);
      });

      await waitFor(() =>
        expect(result.current.patternLists.map((l) => l.name)).toEqual([
          "Fresh",
        ]),
      );
    });

    it("closes the modal and stops the spinner", async () => {
      const { result } = await mount();

      await act(async () => {
        await result.current.handleImport([]);
      });

      expect(result.current.showImportModal).toBe(false);
      expect(result.current.isLoading).toBe(false);
    });

    it("does not copy the patterns into the list record", async () => {
      // `@patternLists` holds lists without patterns; `@patterns_{id}` holds
      // the patterns. Writing a PatternListWithPatterns into the first key
      // duplicates every pattern into it — see AGENTS.md, "Persistence".
      const incoming = importable({
        patterns: [createTestPattern("t", { id: 1 })],
      });
      const { result } = await mount();

      await act(async () => {
        await result.current.handleImport([decision(incoming, "replace")]);
      });

      expect((await storedLists())[0]).not.toHaveProperty("patterns");
    });
  });
});
