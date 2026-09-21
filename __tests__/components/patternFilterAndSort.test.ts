import { renderHook } from "@testing-library/react-native";
import { usePatternFilter } from "@/src/pattern/filter/hooks/usePatternFilter";
import { usePatternSort } from "@/src/pattern/list/hooks/usePatternSort";
import { PatternFilter } from "@/src/pattern/filter/components/PatternFilterBottomSheet";
import { SortConfig } from "@/src/pattern/list/SortBottomSheet";
import { PatternLevel } from "@/src/pattern/types/PatternLevel";
import { IPattern } from "@/src/pattern/types/IPatternList";
import { createTestPattern } from "@/utils/testFactories";

const TYPE_A = "type-a";
const TYPE_B = "type-b";

const pattern = (id: number, overrides: Partial<IPattern> = {}) =>
  createTestPattern(TYPE_A, { id, name: `P${id}`, ...overrides });

const emptyFilter: PatternFilter = {
  name: "",
  types: [],
  levels: [],
  counts: undefined,
  tags: [],
};

const filterWith = (patterns: IPattern[], filter: Partial<PatternFilter>) =>
  renderHook(() => usePatternFilter(patterns, { ...emptyFilter, ...filter }));

const names = (patterns: IPattern[]) => patterns.map((p) => p.name);

const sortWith = (patterns: IPattern[], sortConfig: SortConfig) =>
  renderHook(() => usePatternSort(patterns, sortConfig));

describe("usePatternFilter", () => {
  it("returns everything when nothing is set", () => {
    const patterns = [pattern(1), pattern(2)];

    const { result } = filterWith(patterns, {});

    expect(result.current.filteredPatterns).toHaveLength(2);
    expect(result.current.hasActiveFilter).toBe(false);
  });

  describe("by name", () => {
    it("matches a substring, ignoring case", () => {
      const patterns = [
        pattern(1, { name: "Sugar Push" }),
        pattern(2, { name: "Whip" }),
      ];

      const { result } = filterWith(patterns, { name: "sugar" });

      expect(names(result.current.filteredPatterns)).toEqual(["Sugar Push"]);
      expect(result.current.hasActiveFilter).toBe(true);
    });

    it("matches nothing when no name contains it", () => {
      const { result } = filterWith([pattern(1, { name: "Whip" })], {
        name: "zzz",
      });

      expect(result.current.filteredPatterns).toEqual([]);
    });
  });

  describe("by type", () => {
    it("keeps only the selected types", () => {
      const patterns = [
        pattern(1, { typeId: TYPE_A }),
        pattern(2, { typeId: TYPE_B }),
      ];

      const { result } = filterWith(patterns, { types: [TYPE_B] });

      expect(names(result.current.filteredPatterns)).toEqual(["P2"]);
    });

    it("treats several selected types as an either/or", () => {
      const patterns = [
        pattern(1, { typeId: TYPE_A }),
        pattern(2, { typeId: TYPE_B }),
        pattern(3, { typeId: "type-c" }),
      ];

      const { result } = filterWith(patterns, { types: [TYPE_A, TYPE_B] });

      expect(names(result.current.filteredPatterns)).toEqual(["P1", "P2"]);
    });
  });

  describe("by level", () => {
    it("keeps only the selected levels", () => {
      const patterns = [
        pattern(1, { level: PatternLevel.BEGINNER }),
        pattern(2, { level: PatternLevel.ADVANCED }),
      ];

      const { result } = filterWith(patterns, {
        levels: [PatternLevel.ADVANCED],
      });

      expect(names(result.current.filteredPatterns)).toEqual(["P2"]);
    });

    it("excludes a pattern with no level at all", () => {
      const patterns = [pattern(1, { level: undefined })];

      const { result } = filterWith(patterns, {
        levels: [PatternLevel.BEGINNER],
      });

      expect(result.current.filteredPatterns).toEqual([]);
    });
  });

  describe("by counts", () => {
    it("matches the exact count", () => {
      const patterns = [pattern(1, { counts: 6 }), pattern(2, { counts: 8 })];

      const { result } = filterWith(patterns, { counts: 8 });

      expect(names(result.current.filteredPatterns)).toEqual(["P2"]);
    });

    it("ignores the filter when no count is chosen", () => {
      const patterns = [pattern(1, { counts: 6 }), pattern(2, { counts: 8 })];

      const { result } = filterWith(patterns, { counts: undefined });

      expect(result.current.filteredPatterns).toHaveLength(2);
    });

    it("can match a count of zero", () => {
      // `0` is falsy; a truthiness check here would silently ignore it.
      const patterns = [pattern(1, { counts: 0 }), pattern(2, { counts: 6 })];

      const { result } = filterWith(patterns, { counts: 0 });

      expect(names(result.current.filteredPatterns)).toEqual(["P1"]);
      expect(result.current.hasActiveFilter).toBe(true);
    });
  });

  describe("by tag", () => {
    it("requires every selected tag, not just one", () => {
      const patterns = [
        pattern(1, { tags: ["basic"] }),
        pattern(2, { tags: ["basic", "6-count"] }),
      ];

      const { result } = filterWith(patterns, { tags: ["basic", "6-count"] });

      expect(names(result.current.filteredPatterns)).toEqual(["P2"]);
    });

    it("ignores case", () => {
      const patterns = [pattern(1, { tags: ["Basic"] })];

      const { result } = filterWith(patterns, { tags: ["basic"] });

      expect(result.current.filteredPatterns).toHaveLength(1);
    });

    it("excludes a pattern with no tags", () => {
      const { result } = filterWith([pattern(1, { tags: [] })], {
        tags: ["basic"],
      });

      expect(result.current.filteredPatterns).toEqual([]);
    });
  });

  describe("combining filters", () => {
    it("requires all of them to match", () => {
      const patterns = [
        pattern(1, { name: "Sugar Push", typeId: TYPE_A, counts: 6 }),
        pattern(2, { name: "Sugar Tuck", typeId: TYPE_B, counts: 6 }),
        pattern(3, { name: "Sugar Push", typeId: TYPE_A, counts: 8 }),
      ];

      const { result } = filterWith(patterns, {
        name: "sugar",
        types: [TYPE_A],
        counts: 6,
      });

      expect(result.current.filteredPatterns.map((p) => p.id)).toEqual([1]);
    });
  });

  describe("hasActiveFilter", () => {
    it.each([
      ["name", { name: "x" }],
      ["types", { types: [TYPE_A] }],
      ["levels", { levels: [PatternLevel.BEGINNER] }],
      ["counts", { counts: 6 }],
      ["tags", { tags: ["basic"] }],
    ])("is true when %s is set", (_label, filter) => {
      const { result } = filterWith(
        [pattern(1)],
        filter as Partial<PatternFilter>,
      );

      expect(result.current.hasActiveFilter).toBe(true);
    });
  });
});

describe("usePatternSort", () => {
  it("does not reorder the caller's array in place", () => {
    const patterns = [pattern(2, { name: "B" }), pattern(1, { name: "A" })];

    sortWith(patterns, { field: "name", order: "asc" });

    expect(names(patterns)).toEqual(["B", "A"]);
  });

  describe("by name", () => {
    it("sorts ascending, ignoring case", () => {
      const patterns = [
        pattern(1, { name: "whip" }),
        pattern(2, { name: "Anchor" }),
        pattern(3, { name: "Sugar Push" }),
      ];

      const { result } = sortWith(patterns, { field: "name", order: "asc" });

      expect(names(result.current.sortedPatterns)).toEqual([
        "Anchor",
        "Sugar Push",
        "whip",
      ]);
    });

    it("reverses for descending", () => {
      const patterns = [pattern(1, { name: "A" }), pattern(2, { name: "B" })];

      const { result } = sortWith(patterns, { field: "name", order: "desc" });

      expect(names(result.current.sortedPatterns)).toEqual(["B", "A"]);
    });
  });

  describe("by counts", () => {
    it("compares numerically rather than as text", () => {
      // A string comparison would put 10 before 9.
      const patterns = [
        pattern(1, { counts: 9 }),
        pattern(2, { counts: 10 }),
        pattern(3, { counts: 6 }),
      ];

      const { result } = sortWith(patterns, { field: "counts", order: "asc" });

      expect(result.current.sortedPatterns.map((p) => p.counts)).toEqual([
        6, 9, 10,
      ]);
    });
  });

  describe("by id", () => {
    it("stands in for creation order", () => {
      const patterns = [pattern(3), pattern(1), pattern(2)];

      const { result } = sortWith(patterns, { field: "id", order: "asc" });

      expect(result.current.sortedPatterns.map((p) => p.id)).toEqual([1, 2, 3]);
    });
  });

  describe("missing values", () => {
    it("pushes patterns with no level to the end", () => {
      const patterns = [
        pattern(1, { level: undefined }),
        pattern(2, { level: PatternLevel.BEGINNER }),
      ];

      const { result } = sortWith(patterns, { field: "level", order: "asc" });

      expect(result.current.sortedPatterns.map((p) => p.id)).toEqual([2, 1]);
    });
  });

  it("handles an empty list", () => {
    const { result } = sortWith([], { field: "name", order: "asc" });

    expect(result.current.sortedPatterns).toEqual([]);
  });
});
