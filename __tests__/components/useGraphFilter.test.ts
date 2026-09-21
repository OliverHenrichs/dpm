import { act } from "@testing-library/react-native";
import {
  EMPTY_FILTER,
  useGraphFilter,
} from "@/src/pattern/graph/hooks/useGraphFilter";
import { PatternFilter } from "@/src/pattern/filter/components/PatternFilterBottomSheet";
import { IPattern } from "@/src/pattern/types/IPatternList";
import {
  createTestPattern,
  createTestPatternType,
} from "@/utils/testFactories";
import { renderHookWithProviders } from "@/utils/renderWithProviders";

const TYPE = createTestPatternType({ slug: "push" });
const OTHER_TYPE = createTestPatternType({ slug: "pass" });

const pattern = (
  id: number,
  name: string,
  prerequisites: number[] = [],
  typeId = TYPE.id,
): IPattern => createTestPattern(typeId, { id, name, prerequisites });

/** Sugar Push → Whip → Basket Whip, plus an unrelated Side Pass. */
const PATTERNS = [
  pattern(1, "Sugar Push"),
  pattern(2, "Whip", [1]),
  pattern(3, "Basket Whip", [2]),
  pattern(4, "Side Pass", [], OTHER_TYPE.id),
];

const renderGraphFilter = (patterns = PATTERNS, listId = "list-1") =>
  renderHookWithProviders(() =>
    useGraphFilter(patterns, [TYPE, OTHER_TYPE], listId),
  );

const shownIds = (result: { current: { model: { nodes: unknown[] } } }) =>
  (result.current.model.nodes as { pattern: IPattern }[])
    .map((n) => n.pattern.id)
    .sort((a, b) => a - b);

const nameFilter = (name: string): PatternFilter => ({
  ...EMPTY_FILTER,
  name,
});

describe("useGraphFilter", () => {
  describe("with no filter", () => {
    it("shows every pattern", () => {
      const { result } = renderGraphFilter();

      expect(shownIds(result)).toEqual([1, 2, 3, 4]);
      expect(result.current.hasActiveFilter).toBe(false);
    });

    it("hands back the full model itself, not a copy of it", () => {
      // The narrowing pass is skipped entirely while no filter is set, which
      // is the state the screen spends nearly all its time in.
      const { result } = renderGraphFilter();

      expect(result.current.model).toBe(result.current.fullModel);
    });

    it("defaults to pulling in prerequisites", () => {
      const { result } = renderGraphFilter();

      expect(result.current.chainMode).toBe("prerequisites");
    });
  });

  describe("with a filter", () => {
    it("shows a match and the path to it", () => {
      const { result } = renderGraphFilter();

      act(() => result.current.setFilter(nameFilter("Basket")));

      expect(shownIds(result)).toEqual([1, 2, 3]);
    });

    it("counts matches separately from what is shown", () => {
      const { result } = renderGraphFilter();

      act(() => result.current.setFilter(nameFilter("Basket")));

      expect({
        matched: result.current.matchedCount,
        shown: result.current.shownCount,
        total: result.current.totalCount,
      }).toEqual({ matched: 1, shown: 3, total: 4 });
    });

    it("drops the context when the chain mode says matches only", () => {
      const { result } = renderGraphFilter();

      act(() => result.current.setFilter(nameFilter("Basket")));
      act(() => result.current.setChainMode("matchesOnly"));

      expect(shownIds(result)).toEqual([3]);
    });

    it("pulls in dependents too on the full chain", () => {
      const { result } = renderGraphFilter();

      act(() => result.current.setFilter(nameFilter("Whip")));
      act(() => result.current.setChainMode("fullChain"));

      // "Whip" matches Whip and Basket Whip; the chain reaches back to Sugar
      // Push but never to the unrelated Side Pass.
      expect(shownIds(result)).toEqual([1, 2, 3]);
    });

    it("marks context apart from matches", () => {
      const { result } = renderGraphFilter();

      act(() => result.current.setFilter(nameFilter("Basket")));

      const nodes = result.current.model.nodes;
      expect(nodes.filter((n) => n.isMatch).map((n) => n.pattern.id)).toEqual([
        3,
      ]);
      expect(nodes.filter((n) => n.isContext).map((n) => n.pattern.id)).toEqual(
        [1, 2],
      );
    });

    it("shows nothing when nothing matches", () => {
      const { result } = renderGraphFilter();

      act(() => result.current.setFilter(nameFilter("Tuck Turn")));

      expect(shownIds(result)).toEqual([]);
      expect(result.current.hasActiveFilter).toBe(true);
    });

    it("skips the narrowing pass when the filter matches everything", () => {
      const { result } = renderGraphFilter();

      // A type filter covering both types is active but excludes nothing.
      act(() =>
        result.current.setFilter({
          ...EMPTY_FILTER,
          types: [TYPE.id, OTHER_TYPE.id],
        }),
      );

      expect(result.current.model).toBe(result.current.fullModel);
    });

    it("rewrites prerequisites so nothing points off-screen", () => {
      const { result } = renderGraphFilter();

      act(() => result.current.setFilter(nameFilter("Basket")));
      act(() => result.current.setChainMode("matchesOnly"));

      expect(result.current.model.nodes[0].pattern.prerequisites).toEqual([]);
    });
  });

  describe("clearing", () => {
    it("restores the whole graph", () => {
      const { result } = renderGraphFilter();

      act(() => result.current.setFilter(nameFilter("Basket")));
      act(() => result.current.clearFilter());

      expect(shownIds(result)).toEqual([1, 2, 3, 4]);
      expect(result.current.hasActiveFilter).toBe(false);
    });

    it("leaves the chain mode alone", () => {
      // The mode is a preference about how to read the graph, not part of the
      // query, so resetting the query should not undo it.
      const { result } = renderGraphFilter();

      act(() => result.current.setChainMode("fullChain"));
      act(() => result.current.clearFilter());

      expect(result.current.chainMode).toBe("fullChain");
    });

    it("drops a filter written against another list", () => {
      const { result, rerender } = renderHookWithProviders(
        ({ listId }: { listId: string }) =>
          useGraphFilter(PATTERNS, [TYPE, OTHER_TYPE], listId),
        { initialProps: { listId: "list-1" } },
      );

      act(() => result.current.setFilter(nameFilter("Basket")));
      rerender({ listId: "list-2" });

      expect(result.current.hasActiveFilter).toBe(false);
      expect(shownIds(result)).toEqual([1, 2, 3, 4]);
    });
  });
});
