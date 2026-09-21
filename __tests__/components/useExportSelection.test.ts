import { act, renderHook } from "@testing-library/react-native";
import { useExportSelection } from "@/src/pattern/data/hooks/useExportSelection";
import { PatternListWithPatterns } from "@/src/pattern/data/types/IExportData";
import {
  createTestPattern,
  createTestPatternList,
} from "@/utils/testFactories";

const exportable = (
  patternCount = 0,
  overrides: Partial<PatternListWithPatterns> = {},
): PatternListWithPatterns => ({
  ...createTestPatternList(),
  patterns: Array.from({ length: patternCount }, (_, i) =>
    createTestPattern("t", { id: i + 1 }),
  ),
  ...overrides,
});

const mount = (patternLists: PatternListWithPatterns[]) =>
  renderHook(() => useExportSelection({ patternLists }));

describe("useExportSelection", () => {
  it("starts with everything selected", () => {
    const lists = [exportable(), exportable()];

    const { result } = mount(lists);

    expect(result.current.stats.selectedCount).toBe(2);
    expect(result.current.getSelectedLists()).toHaveLength(2);
  });

  describe("toggleSelection", () => {
    it("deselects a selected list", () => {
      const [a, b] = [exportable(), exportable()];
      const { result } = mount([a, b]);

      act(() => result.current.toggleSelection(a.id));

      expect(result.current.selectedIds.has(a.id)).toBe(false);
      expect(result.current.getSelectedLists().map((l) => l.id)).toEqual([
        b.id,
      ]);
    });

    it("reselects a deselected list", () => {
      const a = exportable();
      const { result } = mount([a]);

      act(() => result.current.toggleSelection(a.id));
      act(() => result.current.toggleSelection(a.id));

      expect(result.current.selectedIds.has(a.id)).toBe(true);
    });
  });

  describe("toggleSelectAll", () => {
    it("clears the selection when everything is selected", () => {
      const { result } = mount([exportable(), exportable()]);

      act(() => result.current.toggleSelectAll());

      expect(result.current.stats.selectedCount).toBe(0);
      expect(result.current.stats.noneSelected).toBe(true);
    });

    it("selects everything from a partial selection", () => {
      const [a, b] = [exportable(), exportable()];
      const { result } = mount([a, b]);

      act(() => result.current.toggleSelection(a.id));
      act(() => result.current.toggleSelectAll());

      expect(result.current.stats.selectedCount).toBe(2);
      expect(result.current.stats.allSelected).toBe(true);
    });

    it("selects everything from an empty selection", () => {
      const { result } = mount([exportable(), exportable()]);

      act(() => result.current.toggleSelectAll());
      act(() => result.current.toggleSelectAll());

      expect(result.current.stats.selectedCount).toBe(2);
    });
  });

  describe("stats", () => {
    it("counts the patterns across the selected lists only", () => {
      const [a, b] = [exportable(2), exportable(3)];
      const { result } = mount([a, b]);

      expect(result.current.stats.totalSelectedPatterns).toBe(5);

      act(() => result.current.toggleSelection(a.id));

      expect(result.current.stats.totalSelectedPatterns).toBe(3);
    });

    it("reports the total independently of the selection", () => {
      const [a] = [exportable(), exportable()];
      const { result } = mount([a, exportable()]);

      act(() => result.current.toggleSelection(a.id));

      expect(result.current.stats.totalCount).toBe(2);
      expect(result.current.stats.selectedCount).toBe(1);
      expect(result.current.stats.allSelected).toBe(false);
      expect(result.current.stats.noneSelected).toBe(false);
    });
  });

  describe("with no lists at all", () => {
    it("reports nothing to select", () => {
      const { result } = mount([]);

      expect(result.current.stats.selectedCount).toBe(0);
      expect(result.current.stats.totalCount).toBe(0);
      expect(result.current.getSelectedLists()).toEqual([]);
    });

    it("reports both allSelected and noneSelected, which callers must not treat as a contradiction", () => {
      // `allSelected` is `selected === total`, so 0 === 0 is true. The export
      // button is gated on `noneSelected`, so this is harmless — but a "select
      // all" checkbox driven by `allSelected` would render as ticked on an
      // empty list.
      const { result } = mount([]);

      expect(result.current.stats.allSelected).toBe(true);
      expect(result.current.stats.noneSelected).toBe(true);
    });
  });
});
