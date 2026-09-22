import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  subscribeToSharedList,
  syncPublishedList,
} from "@/src/firebase/FirebaseListService";
import { usePatternCrud } from "@/src/pattern/list/hooks/usePatternCrud";
import {
  IModifier,
  IPattern,
  IPatternList,
} from "@/src/pattern/types/IPatternList";
import { generateUUID } from "@/src/pattern/types/PatternType";
import {
  createTestPattern,
  createTestPatternList,
} from "@/utils/testFactories";
import {
  act,
  renderHookWithProviders,
  waitFor,
} from "@/utils/renderWithProviders";

// `subscribeToSharedList` is mocked too: setting a shareCode activates the
// provider's live-subscription hook, and a missing export there surfaces as an
// unhelpful "window.dispatchEvent is not a function" from React's error
// reporting rather than as the TypeError it really is.
jest.mock("@/src/firebase/FirebaseListService", () => ({
  syncPublishedList: jest.fn(),
  subscribeToSharedList: jest.fn(),
}));

const mockedSync = syncPublishedList as jest.MockedFunction<
  typeof syncPublishedList
>;

// `clearMocks` wipes the factory's implementation as well as its call log, and
// the production code calls `.catch()` on what this returns — so the resolved
// value has to be re-established per test, not just declared in the factory.
beforeEach(() => {
  mockedSync.mockResolvedValue(undefined);
  (subscribeToSharedList as jest.Mock).mockReturnValue(() => {});
});

const TYPE_ID = "type-1";

const pattern = (id: number, overrides: Partial<IPattern> = {}) =>
  createTestPattern(TYPE_ID, { id, name: `P${id}`, ...overrides });

const modifier = (name = "with a spin"): IModifier => ({
  id: generateUUID(),
  name,
  position: "postfix",
  universal: false,
  videoRefs: [],
});

/**
 * Mounts the hook against a seeded active list and waits for the provider's
 * initial storage load to land, so tests act on real state rather than on the
 * empty first render.
 */
async function mountCrud(
  patterns: IPattern[] = [],
  listOverrides: Partial<IPatternList> = {},
) {
  const list = createTestPatternList(listOverrides);
  const view = renderHookWithProviders(() => usePatternCrud(), {
    lists: [list],
    patterns: { [list.id]: patterns },
  });
  // Wait for `activeList`, not for the pattern count: an empty expected count
  // is already satisfied by the first render, before the provider has loaded
  // anything, and every mutation no-ops while `activeList` is null.
  await waitFor(() => expect(view.result.current.activeList).not.toBeNull());
  await waitFor(() =>
    expect(view.result.current.patterns).toHaveLength(patterns.length),
  );
  return { ...view, list };
}

/** Patterns as they exist in storage, which is what actually persisted. */
const storedPatterns = async (listId: string): Promise<IPattern[]> =>
  JSON.parse((await AsyncStorage.getItem(`@patterns_${listId}`)) ?? "[]");

const storedList = async (listId: string): Promise<IPatternList> => {
  const lists: IPatternList[] = JSON.parse(
    (await AsyncStorage.getItem("@patternLists")) ?? "[]",
  );
  return lists.find((l) => l.id === listId)!;
};

describe("usePatternCrud", () => {
  describe("addPattern", () => {
    it("persists the pattern and reports success", async () => {
      const { result, list } = await mountCrud([]);

      let ok: boolean | undefined;
      await act(async () => {
        ok = await result.current.addPattern(pattern(0, { name: "Whip" }));
      });

      expect(ok).toBe(true);
      const stored = await storedPatterns(list.id);
      expect(stored.map((p) => p.name)).toEqual(["Whip"]);
    });

    it("numbers the first pattern 1", async () => {
      const { result, list } = await mountCrud([]);

      await act(async () => {
        await result.current.addPattern(pattern(0, { name: "Whip" }));
      });

      expect((await storedPatterns(list.id))[0].id).toBe(1);
    });

    it("takes the next id after the highest in use", async () => {
      const { result, list } = await mountCrud([pattern(1), pattern(7)]);

      await act(async () => {
        await result.current.addPattern(pattern(0, { name: "New" }));
      });

      const stored = await storedPatterns(list.id);
      expect(stored.find((p) => p.name === "New")!.id).toBe(8);
    });

    it("records the next id on the list, not just in memory", async () => {
      const { result, list } = await mountCrud([pattern(1), pattern(7)]);

      await act(async () => {
        await result.current.addPattern(pattern(0, { name: "New" }));
      });

      expect((await storedList(list.id)).nextPatternId).toBe(9);
    });

    /**
     * The defect this guards (B14): ids were `max(id) + 1` over the patterns
     * present, so deleting the highest-numbered pattern handed its id to the
     * next one created. Anything keyed by pattern id and outliving a single
     * pattern — the manual graph layout — then attached to the wrong one.
     */
    it("does not reuse the id of a deleted pattern", async () => {
      // Consecutive ids on purpose: deleting the *highest* is what made
      // `max(id) + 1` hand the same number straight back out.
      const { result, list } = await mountCrud([
        pattern(1),
        pattern(2),
        pattern(3),
      ]);

      await act(async () => {
        await result.current.deletePattern(3);
      });
      await act(async () => {
        await result.current.addPattern(pattern(0, { name: "New" }));
      });

      const stored = await storedPatterns(list.id);
      expect(stored.find((p) => p.name === "New")!.id).toBe(4);
    });

    it("keeps handing out fresh ids across repeated add-and-delete", async () => {
      const { result, list } = await mountCrud([]);
      const ids: number[] = [];

      for (let round = 0; round < 4; round++) {
        await act(async () => {
          await result.current.addPattern(pattern(0, { name: `P${round}` }));
        });
        const stored = await storedPatterns(list.id);
        const added = stored.find((p) => p.name === `P${round}`)!;
        ids.push(added.id);
        await act(async () => {
          await result.current.deletePattern(added.id);
        });
      }

      expect(new Set(ids).size).toBe(ids.length);
    });

    it("starts past the highest id when a list has no mark yet", async () => {
      // Lists written before the field existed keep working, and gain a mark
      // the first time a pattern is added to them.
      const { result, list } = await mountCrud([pattern(4)], {
        nextPatternId: undefined,
      });

      await act(async () => {
        await result.current.addPattern(pattern(0, { name: "New" }));
      });

      const stored = await storedPatterns(list.id);
      expect(stored.find((p) => p.name === "New")!.id).toBe(5);
      expect((await storedList(list.id)).nextPatternId).toBe(6);
    });

    it("refuses a blank name and leaves storage alone", async () => {
      const { result, list } = await mountCrud([]);

      let ok: boolean | undefined;
      await act(async () => {
        ok = await result.current.addPattern(pattern(0, { name: "   " }));
      });

      expect(ok).toBe(false);
      expect(await storedPatterns(list.id)).toEqual([]);
    });

    it("refuses on a read-only list", async () => {
      const { result, list } = await mountCrud([], { readonly: true });

      let ok: boolean | undefined;
      await act(async () => {
        ok = await result.current.addPattern(pattern(0, { name: "Whip" }));
      });

      expect(ok).toBe(false);
      expect(await storedPatterns(list.id)).toEqual([]);
    });
  });

  describe("editPattern", () => {
    it("replaces the pattern in place", async () => {
      const { result, list } = await mountCrud([pattern(1), pattern(2)]);

      await act(async () => {
        await result.current.editPattern({ ...pattern(1), name: "Renamed" });
      });

      const stored = await storedPatterns(list.id);
      expect(stored).toHaveLength(2);
      expect(stored.find((p) => p.id === 1)!.name).toBe("Renamed");
      expect(stored.find((p) => p.id === 2)!.name).toBe("P2");
    });

    it("refuses a blank name", async () => {
      const { result, list } = await mountCrud([pattern(1)]);

      let ok: boolean | undefined;
      await act(async () => {
        ok = await result.current.editPattern({ ...pattern(1), name: "" });
      });

      expect(ok).toBe(false);
      expect((await storedPatterns(list.id))[0].name).toBe("P1");
    });

    it("refuses a pattern with no id", async () => {
      const { result } = await mountCrud([pattern(1)]);
      const { id: _id, ...withoutId } = pattern(1, { name: "Nameless" });

      let ok: boolean | undefined;
      await act(async () => {
        ok = await result.current.editPattern(withoutId);
      });

      expect(ok).toBe(false);
    });

    it("refuses on a read-only list", async () => {
      const { result, list } = await mountCrud([pattern(1)], {
        readonly: true,
      });

      await act(async () => {
        await result.current.editPattern({ ...pattern(1), name: "Renamed" });
      });

      expect((await storedPatterns(list.id))[0].name).toBe("P1");
    });
  });

  describe("deletePattern", () => {
    it("removes the pattern", async () => {
      const { result, list } = await mountCrud([pattern(1), pattern(2)]);

      await act(async () => {
        await result.current.deletePattern(1);
      });

      expect((await storedPatterns(list.id)).map((p) => p.id)).toEqual([2]);
    });

    it("scrubs the deleted id from every prerequisite list", async () => {
      // The whole point of AGENT_TASKS.md B1: a left-behind id makes the
      // dependent vanish from the network graph.
      const { result, list } = await mountCrud([
        pattern(1),
        pattern(2, { prerequisites: [1] }),
        pattern(3, { prerequisites: [1, 2] }),
      ]);

      await act(async () => {
        await result.current.deletePattern(1);
      });

      const stored = await storedPatterns(list.id);
      expect(stored.map((p) => p.prerequisites)).toEqual([[], [2]]);
    });

    it("refuses an undefined id rather than deleting nothing quietly", async () => {
      const { result } = await mountCrud([pattern(1)]);

      let ok: boolean | undefined;
      await act(async () => {
        ok = await result.current.deletePattern(undefined);
      });

      expect(ok).toBe(false);
    });

    it("refuses on a read-only list", async () => {
      const { result, list } = await mountCrud([pattern(1)], {
        readonly: true,
      });

      await act(async () => {
        await result.current.deletePattern(1);
      });

      expect(await storedPatterns(list.id)).toHaveLength(1);
    });
  });

  describe("modifiers", () => {
    it("adds a modifier with a generated id", async () => {
      const { result, list } = await mountCrud([]);

      await act(async () => {
        await result.current.addModifier({
          name: "slow",
          position: "prefix",
          universal: true,
          videoRefs: [],
        });
      });

      const stored = await storedList(list.id);
      expect(stored.modifiers).toHaveLength(1);
      expect(stored.modifiers[0].name).toBe("slow");
      expect(stored.modifiers[0].id).toEqual(expect.any(String));
    });

    it("refuses a blank modifier name", async () => {
      const { result, list } = await mountCrud([]);

      let ok: boolean | undefined;
      await act(async () => {
        ok = await result.current.addModifier({
          name: "  ",
          position: "prefix",
          universal: true,
          videoRefs: [],
        });
      });

      expect(ok).toBe(false);
      expect((await storedList(list.id)).modifiers).toEqual([]);
    });

    it("edits a modifier in place", async () => {
      const existing = modifier();
      const { result, list } = await mountCrud([], { modifiers: [existing] });

      await act(async () => {
        await result.current.editModifier({ ...existing, name: "renamed" });
      });

      expect((await storedList(list.id)).modifiers[0].name).toBe("renamed");
    });

    it("deletes a modifier and detaches it from every pattern", async () => {
      const attached = modifier();
      const other = modifier("slow");
      const { result, list } = await mountCrud(
        [
          pattern(1, {
            modifierRefs: [
              { modifierId: attached.id, videoRefs: [] },
              { modifierId: other.id, videoRefs: [] },
            ],
          }),
          pattern(2, {
            modifierRefs: [{ modifierId: attached.id, videoRefs: [] }],
          }),
        ],
        { modifiers: [attached, other] },
      );

      await act(async () => {
        await result.current.deleteModifier(attached.id);
      });

      expect((await storedList(list.id)).modifiers.map((m) => m.id)).toEqual([
        other.id,
      ]);
      const stored = await storedPatterns(list.id);
      expect(stored[0].modifierRefs.map((r) => r.modifierId)).toEqual([
        other.id,
      ]);
      expect(stored[1].modifierRefs).toEqual([]);
    });

    it("refuses modifier changes on a read-only list", async () => {
      const existing = modifier();
      const { result, list } = await mountCrud([], {
        modifiers: [existing],
        readonly: true,
      });

      await act(async () => {
        await result.current.deleteModifier(existing.id);
      });

      expect((await storedList(list.id)).modifiers).toHaveLength(1);
    });
  });

  describe("cloud sync", () => {
    it("pushes to Firestore after a pattern change when the list is published", async () => {
      const { result } = await mountCrud([], { shareCode: "ABCD1234" });

      await act(async () => {
        await result.current.addPattern(pattern(0, { name: "Whip" }));
      });

      expect(mockedSync).toHaveBeenCalledWith(
        expect.objectContaining({ shareCode: "ABCD1234" }),
        expect.arrayContaining([expect.objectContaining({ name: "Whip" })]),
      );
    });

    it("stays local when the list is not published", async () => {
      const { result } = await mountCrud([]);

      await act(async () => {
        await result.current.addPattern(pattern(0, { name: "Whip" }));
      });

      expect(mockedSync).not.toHaveBeenCalled();
    });

    it("keeps the local edit when the push fails", async () => {
      // The sync is opportunistic: the local write has already happened, and a
      // network failure must not surface as a failed edit.
      mockedSync.mockRejectedValueOnce(new Error("offline"));
      const { result, list } = await mountCrud([], { shareCode: "ABCD1234" });

      let ok: boolean | undefined;
      await act(async () => {
        ok = await result.current.addPattern(pattern(0, { name: "Whip" }));
      });

      expect(ok).toBe(true);
      expect(await storedPatterns(list.id)).toHaveLength(1);
    });
  });

  describe("derived state", () => {
    it("exposes the active list's types and modifiers", async () => {
      const existing = modifier();
      const { result, list } = await mountCrud([], { modifiers: [existing] });

      expect(result.current.patternTypes).toEqual(list.patternTypes);
      expect(result.current.modifiers).toEqual([existing]);
      expect(result.current.isReadonly).toBe(false);
    });

    it("reports a read-only list as such", async () => {
      const { result } = await mountCrud([], { readonly: true });

      expect(result.current.isReadonly).toBe(true);
    });

    it("copes with no active list at all", async () => {
      const { result } = renderHookWithProviders(() => usePatternCrud());

      await waitFor(() => expect(result.current.activeList).toBeNull());
      expect(result.current.patterns).toEqual([]);
      expect(result.current.patternTypes).toEqual([]);
      expect(result.current.modifiers).toEqual([]);

      let ok: boolean | undefined;
      await act(async () => {
        ok = await result.current.addModifier({
          name: "slow",
          position: "prefix",
          universal: true,
          videoRefs: [],
        });
      });
      expect(ok).toBe(false);
    });
  });
});
