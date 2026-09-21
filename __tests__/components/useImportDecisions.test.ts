import { act, renderHook } from "@testing-library/react-native";
import { useImportDecisions } from "@/src/pattern/data/hooks/useImportDecisions";
import { PatternListWithPatterns } from "@/src/pattern/data/types/IExportData";
import { IPatternList } from "@/src/pattern/types/IPatternList";
import {
  createTestPattern,
  createTestPatternList,
} from "@/utils/testFactories";

function importable(
  overrides: Partial<PatternListWithPatterns> = {},
): PatternListWithPatterns {
  const list = createTestPatternList();
  return { ...list, patterns: [], ...overrides };
}

const withPatterns = (count: number) =>
  Array.from({ length: count }, (_, i) =>
    createTestPattern("t", { id: i + 1 }),
  );

function mount(
  importedLists: PatternListWithPatterns[],
  existingLists: IPatternList[] = [],
) {
  return renderHook(
    (props: {
      importedLists: PatternListWithPatterns[];
      existingLists: IPatternList[];
    }) => useImportDecisions(props),
    { initialProps: { importedLists, existingLists } },
  );
}

describe("useImportDecisions", () => {
  describe("defaults", () => {
    it("replaces a list that is not already present", () => {
      const incoming = importable();

      const { result } = mount([incoming]);

      expect(result.current.decisions.get(incoming.id)).toBe("replace");
    });

    it("skips a list whose id is already present", () => {
      // Skipping is the safe default: the local copy may have edits the
      // imported file does not.
      const existing = createTestPatternList();
      const incoming = importable({ id: existing.id });

      const { result } = mount([incoming], [existing]);

      expect(result.current.decisions.get(incoming.id)).toBe("skip");
    });

    it("decides per list rather than for the batch", () => {
      const existing = createTestPatternList();
      const conflicting = importable({ id: existing.id });
      const fresh = importable();

      const { result } = mount([conflicting, fresh], [existing]);

      expect(result.current.decisions.get(conflicting.id)).toBe("skip");
      expect(result.current.decisions.get(fresh.id)).toBe("replace");
    });
  });

  describe("setAction", () => {
    it("overrides the default", () => {
      const existing = createTestPatternList();
      const incoming = importable({ id: existing.id });
      const { result } = mount([incoming], [existing]);

      act(() => result.current.setAction(incoming.id, "replace"));

      expect(result.current.decisions.get(incoming.id)).toBe("replace");
    });

    it("leaves the other lists alone", () => {
      const a = importable();
      const b = importable();
      const { result } = mount([a, b]);

      act(() => result.current.setAction(a.id, "skip"));

      expect(result.current.decisions.get(a.id)).toBe("skip");
      expect(result.current.decisions.get(b.id)).toBe("replace");
    });
  });

  describe("getImportDecisions", () => {
    it("returns one decision per imported list, with the local copy attached", () => {
      const existing = createTestPatternList({ name: "Local" });
      const conflicting = importable({ id: existing.id, name: "Incoming" });
      const fresh = importable({ name: "Brand new" });
      const { result } = mount([conflicting, fresh], [existing]);

      const decisions = result.current.getImportDecisions();

      expect(decisions).toHaveLength(2);
      expect(decisions[0]).toMatchObject({
        action: "skip",
        list: { name: "Incoming" },
        existingList: { name: "Local" },
      });
      expect(decisions[1].existingList).toBeUndefined();
    });

    it("reflects an override", () => {
      const existing = createTestPatternList();
      const incoming = importable({ id: existing.id });
      const { result } = mount([incoming], [existing]);

      act(() => result.current.setAction(incoming.id, "replace"));

      expect(result.current.getImportDecisions()[0].action).toBe("replace");
    });
  });

  describe("stats", () => {
    it("counts lists, patterns and conflicts", () => {
      const existing = createTestPatternList();
      const { result } = mount(
        [
          importable({ id: existing.id, patterns: withPatterns(2) }),
          importable({ patterns: withPatterns(3) }),
        ],
        [existing],
      );

      expect(result.current.stats).toEqual({
        totalLists: 2,
        totalPatternsCount: 5,
        conflictCount: 1,
      });
    });

    it("is all zeroes for an empty import", () => {
      const { result } = mount([]);

      expect(result.current.stats).toEqual({
        totalLists: 0,
        totalPatternsCount: 0,
        conflictCount: 0,
      });
    });
  });

  describe("when the imported lists arrive after mount", () => {
    // This is how the app actually uses it: PatternListImportModal is mounted
    // permanently by SettingsScreen and only toggles `visible`, so the hook
    // first runs with an empty list and the real one arrives as a prop change.
    it("defaults a conflicting list to skip", () => {
      const existing = createTestPatternList();
      const incoming = importable({ id: existing.id });
      const { result, rerender } = mount([], [existing]);

      rerender({ importedLists: [incoming], existingLists: [existing] });

      expect(result.current.getImportDecisions()[0].action).toBe("skip");
    });

    it("still defaults a new list to replace", () => {
      const incoming = importable();
      const { result, rerender } = mount([], []);

      rerender({ importedLists: [incoming], existingLists: [] });

      expect(result.current.getImportDecisions()[0].action).toBe("replace");
    });

    it("re-derives when a second import replaces the first", () => {
      const existing = createTestPatternList();
      const first = importable();
      const second = importable({ id: existing.id });
      const { result, rerender } = mount([first], [existing]);

      rerender({ importedLists: [second], existingLists: [existing] });

      expect(result.current.getImportDecisions()).toHaveLength(1);
      expect(result.current.getImportDecisions()[0].action).toBe("skip");
    });
  });
});
