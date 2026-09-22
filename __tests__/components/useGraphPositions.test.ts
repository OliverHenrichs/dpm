import { act, waitFor } from "@testing-library/react-native";
import { useGraphPositions } from "@/src/pattern/graph/hooks/useGraphPositions";
import {
  loadGraphLayout,
  saveGraphLayout,
} from "@/src/pattern/graph/data/GraphLayoutStorage";
import { LayoutPosition } from "@/src/pattern/graph/utils/GraphUtils";
import { IPattern } from "@/src/pattern/types/IPatternList";
import {
  createTestPattern,
  createTestPatternType,
} from "@/utils/testFactories";
import { renderHookWithProviders } from "@/utils/renderWithProviders";

const TYPE = createTestPatternType({ slug: "push" });
const LIST = "list-1";

const pattern = (id: number, prerequisites: number[] = []): IPattern =>
  createTestPattern(TYPE.id, { id, name: `P${id}`, prerequisites });

const PATTERNS = [pattern(1), pattern(2, [1])];

const AUTO = new Map<number, LayoutPosition>([
  [1, { x: 10, y: 10 }],
  [2, { x: 20, y: 20 }],
]);

// Explicit rather than a default parameter: passing `undefined` to a
// parameter with a default gets the default, which quietly made the
// "no active list" cases test the opposite of what they claimed.
const renderPositions = (listId: string | undefined) =>
  renderHookWithProviders(() => useGraphPositions(listId, PATTERNS, AUTO));

describe("useGraphPositions", () => {
  describe("with no stored layout", () => {
    it("falls back to the automatic one", async () => {
      const { result } = renderPositions(LIST);

      await waitFor(() => expect(result.current.positions.size).toBe(2));
      expect(result.current.positions.get(1)).toEqual({ x: 10, y: 10 });
    });

    it("offers nothing to reset", async () => {
      const { result } = renderPositions(LIST);

      await waitFor(() => expect(result.current.positions.size).toBe(2));
      expect(result.current.hasManualLayout).toBe(false);
    });
  });

  describe("with a stored layout", () => {
    beforeEach(async () => {
      await saveGraphLayout(LIST, {
        version: 1,
        positions: { "1": { x: 500, y: 300 }, "2": { x: 900, y: 300 } },
        updatedAt: 1,
      });
    });

    it("uses it once it has loaded", async () => {
      const { result } = renderPositions(LIST);

      await waitFor(() =>
        expect(result.current.positions.get(1)).toEqual({ x: 500, y: 300 }),
      );
    });

    it("offers a reset", async () => {
      const { result } = renderPositions(LIST);

      await waitFor(() => expect(result.current.hasManualLayout).toBe(true));
    });

    it("goes back to the automatic layout on reset", async () => {
      const { result } = renderPositions(LIST);
      await waitFor(() => expect(result.current.hasManualLayout).toBe(true));

      await act(() => result.current.resetLayout());

      expect(result.current.positions.get(1)).toEqual({ x: 10, y: 10 });
      expect(await loadGraphLayout(LIST)).toBeNull();
    });
  });

  describe("moving a node", () => {
    it("persists the new position", async () => {
      const { result } = renderPositions(LIST);
      await waitFor(() => expect(result.current.positions.size).toBe(2));

      act(() => result.current.moveNode(1, { x: 300, y: 400 }));

      await waitFor(async () =>
        expect((await loadGraphLayout(LIST))?.positions["1"]).toEqual({
          x: 300,
          y: 400,
        }),
      );
    });

    it("persists every node, not just the moved one", async () => {
      // Otherwise the next automatic layout would reshuffle the others.
      const { result } = renderPositions(LIST);
      await waitFor(() => expect(result.current.positions.size).toBe(2));

      act(() => result.current.moveNode(1, { x: 300, y: 400 }));

      await waitFor(async () =>
        expect(
          Object.keys((await loadGraphLayout(LIST))?.positions ?? {}).sort(),
        ).toEqual(["1", "2"]),
      );
    });

    it("shows the new position immediately", async () => {
      const { result } = renderPositions(LIST);
      await waitFor(() => expect(result.current.positions.size).toBe(2));

      act(() => result.current.moveNode(1, { x: 300, y: 400 }));

      expect(result.current.positions.get(1)).toEqual({ x: 300, y: 400 });
    });

    it("drops an entry whose pattern is gone", async () => {
      // The mitigation for recycled pattern ids: prune on every save.
      await saveGraphLayout(LIST, {
        version: 1,
        positions: { "1": { x: 300, y: 300 }, "99": { x: 900, y: 900 } },
        updatedAt: 1,
      });
      const { result } = renderPositions(LIST);
      await waitFor(() =>
        expect(result.current.positions.get(1)).toEqual({ x: 300, y: 300 }),
      );

      act(() => result.current.moveNode(1, { x: 400, y: 400 }));

      await waitFor(async () =>
        expect((await loadGraphLayout(LIST))?.positions["99"]).toBeUndefined(),
      );
    });
  });

  describe("with no active list", () => {
    it("still returns the automatic layout", async () => {
      const { result } = renderPositions(undefined);

      await waitFor(() => expect(result.current.positions.size).toBe(2));
    });

    it("saves nothing", async () => {
      const { result } = renderPositions(undefined);
      await waitFor(() => expect(result.current.positions.size).toBe(2));

      act(() => result.current.moveNode(1, { x: 5, y: 5 }));

      expect(await loadGraphLayout(LIST)).toBeNull();
    });
  });

  describe("switching lists", () => {
    it("does not show one list's arrangement on another", async () => {
      await saveGraphLayout(LIST, {
        version: 1,
        positions: { "1": { x: 500, y: 300 } },
        updatedAt: 1,
      });
      const { result, rerender } = renderHookWithProviders(
        ({ listId }: { listId: string }) =>
          useGraphPositions(listId, PATTERNS, AUTO),
        { initialProps: { listId: LIST } },
      );
      await waitFor(() =>
        expect(result.current.positions.get(1)).toEqual({ x: 500, y: 300 }),
      );

      rerender({ listId: "other-list" });

      expect(result.current.positions.get(1)).toEqual({ x: 10, y: 10 });
    });
  });
});
