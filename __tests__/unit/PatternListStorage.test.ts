import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  loadGraphLayout,
  saveGraphLayout,
} from "@/src/pattern/graph/data/GraphLayoutStorage";
import { seedAsyncStorage } from "@/__mocks__/@react-native-async-storage/async-storage";
import {
  clearAllData,
  collectOrphanedPatternKeys,
  deletePatternList,
  getActiveList,
  getActiveListId,
  getPatternListById,
  hasPatternLists,
  loadAllPatternLists,
  loadPatterns,
  savePatternList,
  savePatterns,
  setActiveListId,
} from "@/src/pattern/data/PatternListStorage";
import {
  createTestPattern,
  createTestPatternList,
} from "@/utils/testFactories";

const LISTS_KEY = "@patternLists";
const ACTIVE_KEY = "@activeListId";
const patternsKey = (listId: string) => `@patterns_${listId}`;

/**
 * These tests run against the in-memory AsyncStorage mock, so they assert on
 * observable state ("the key is gone", "the list round-trips") rather than on
 * which mock methods were called. That keeps them meaningful across refactors
 * of the storage internals.
 */
describe("PatternListStorage", () => {
  describe("loadAllPatternLists", () => {
    it("returns an empty array when nothing is stored", async () => {
      await expect(loadAllPatternLists()).resolves.toEqual([]);
    });

    it("returns the stored lists", async () => {
      const lists = [createTestPatternList(), createTestPatternList()];
      seedAsyncStorage({ [LISTS_KEY]: JSON.stringify(lists) });

      const result = await loadAllPatternLists();

      expect(result).toHaveLength(2);
      expect(result.map((l) => l.id)).toEqual(lists.map((l) => l.id));
    });

    it("returns an empty array rather than throwing on unparseable data", async () => {
      seedAsyncStorage({ [LISTS_KEY]: "{not json" });

      await expect(loadAllPatternLists()).resolves.toEqual([]);
    });

    it("defaults `modifiers` for lists written before modifiers existed", async () => {
      const legacy = createTestPatternList();
      delete (legacy as Partial<typeof legacy>).modifiers;
      seedAsyncStorage({ [LISTS_KEY]: JSON.stringify([legacy]) });

      const [result] = await loadAllPatternLists();

      expect(result.modifiers).toEqual([]);
    });
  });

  describe("savePatternList", () => {
    it("adds a list that is not yet stored", async () => {
      const list = createTestPatternList();

      await savePatternList(list);

      const stored = await loadAllPatternLists();
      expect(stored).toHaveLength(1);
      expect(stored[0].id).toBe(list.id);
    });

    it("updates a list in place instead of appending a duplicate", async () => {
      const list = createTestPatternList();
      await savePatternList(list);

      await savePatternList({ ...list, name: "Updated Name" });

      const stored = await loadAllPatternLists();
      expect(stored).toHaveLength(1);
      expect(stored[0].name).toBe("Updated Name");
      expect(stored[0].updatedAt).toBeGreaterThanOrEqual(list.updatedAt);
    });

    it("leaves other lists untouched", async () => {
      const keep = createTestPatternList({ name: "Keep" });
      const edit = createTestPatternList({ name: "Edit" });
      await savePatternList(keep);
      await savePatternList(edit);

      await savePatternList({ ...edit, name: "Edited" });

      const stored = await loadAllPatternLists();
      expect(stored).toHaveLength(2);
      expect(stored.find((l) => l.id === keep.id)?.name).toBe("Keep");
    });
  });

  describe("keeping patterns out of the list record", () => {
    // `@patternLists` holds lists without patterns. The import and
    // cloud-subscribe paths both hand over a `PatternListWithPatterns`, whose
    // extra array TypeScript cannot see because `IPatternList` has no such
    // field — so the storage layer strips it rather than trusting callers.
    it("drops a patterns array handed in by a caller", async () => {
      const list = createTestPatternList();
      await savePatternList({
        ...list,
        patterns: [createTestPattern("type1", { id: 1 })],
      } as never);

      const [stored] = await loadAllPatternLists();
      expect(stored).not.toHaveProperty("patterns");
      expect(stored.id).toBe(list.id);
    });

    it("drops one that an older build already wrote", async () => {
      const list = createTestPatternList();
      seedAsyncStorage({
        [LISTS_KEY]: JSON.stringify([
          { ...list, patterns: [createTestPattern("type1", { id: 1 })] },
        ]),
      });

      const [stored] = await loadAllPatternLists();
      expect(stored).not.toHaveProperty("patterns");
    });

    it("leaves the real per-list pattern key alone", async () => {
      const list = createTestPatternList();
      await savePatterns(list.id, [createTestPattern("type1", { id: 1 })]);
      await savePatternList({ ...list, patterns: [] } as never);

      await expect(loadPatterns(list.id)).resolves.toHaveLength(1);
    });
  });

  describe("concurrent writes", () => {
    /**
     * `savePatternList` is a read-modify-write over the whole list array. Two
     * overlapping calls used to both read the pre-change array, so whichever
     * wrote second silently discarded the other's change. That is reachable in
     * the app: `PatternListSelector.handleSaveList` and the context's
     * `updateActiveList` can be in flight together.
     */
    it("does not lose one of two lists saved at the same time", async () => {
      const a = createTestPatternList({ name: "A" });
      const b = createTestPatternList({ name: "B" });

      await Promise.all([savePatternList(a), savePatternList(b)]);

      const stored = await loadAllPatternLists();
      expect(stored.map((l) => l.name).sort()).toEqual(["A", "B"]);
    });

    it("keeps every one of many simultaneous saves", async () => {
      const lists = Array.from({ length: 20 }, (_, i) =>
        createTestPatternList({ name: `L${i}` }),
      );

      await Promise.all(lists.map(savePatternList));

      expect(await loadAllPatternLists()).toHaveLength(20);
    });

    it("applies the last edit when the same list is saved twice at once", async () => {
      const list = createTestPatternList({ name: "First" });
      await savePatternList(list);

      await Promise.all([
        savePatternList({ ...list, name: "Second" }),
        savePatternList({ ...list, name: "Third" }),
      ]);

      const stored = await loadAllPatternLists();
      expect(stored).toHaveLength(1);
      // Whichever ran second wins; what must not happen is both being applied
      // to the same stale read and one disappearing.
      expect(["Second", "Third"]).toContain(stored[0].name);
    });

    it("does not lose a save that races a delete", async () => {
      const keep = createTestPatternList({ name: "Keep" });
      const doomed = createTestPatternList({ name: "Doomed" });
      await savePatternList(doomed);

      await Promise.all([savePatternList(keep), deletePatternList(doomed.id)]);

      const stored = await loadAllPatternLists();
      expect(stored.map((l) => l.name)).toEqual(["Keep"]);
    });

    it("keeps a failed write from poisoning the ones behind it", async () => {
      const failing = createTestPatternList({ name: "Fails" });
      const following = createTestPatternList({ name: "Follows" });
      jest
        .spyOn(AsyncStorage, "setItem")
        .mockRejectedValueOnce(new Error("disk full"));

      const results = await Promise.allSettled([
        savePatternList(failing),
        savePatternList(following),
      ]);

      expect(results[0].status).toBe("rejected");
      expect(results[1].status).toBe("fulfilled");
      expect((await loadAllPatternLists()).map((l) => l.name)).toEqual([
        "Follows",
      ]);
    });

    it("serialises pattern writes per list without blocking other lists", async () => {
      await Promise.all([
        savePatterns("a", [createTestPattern("type1", { id: 1 })]),
        savePatterns("b", [
          createTestPattern("type1", { id: 1 }),
          createTestPattern("type1", { id: 2 }),
        ]),
      ]);

      await expect(loadPatterns("a")).resolves.toHaveLength(1);
      await expect(loadPatterns("b")).resolves.toHaveLength(2);
    });
  });

  describe("getPatternListById", () => {
    it("finds a stored list", async () => {
      const list = createTestPatternList();
      await savePatternList(list);

      await expect(getPatternListById(list.id)).resolves.toMatchObject({
        id: list.id,
      });
    });

    it("returns null for an unknown id", async () => {
      await expect(getPatternListById("nope")).resolves.toBeNull();
    });
  });

  describe("deletePatternList", () => {
    it("removes the list and its patterns", async () => {
      const doomed = createTestPatternList();
      const survivor = createTestPatternList();
      await savePatternList(doomed);
      await savePatternList(survivor);
      await savePatterns(doomed.id, [createTestPattern("type1", { id: 1 })]);

      await deletePatternList(doomed.id);

      const stored = await loadAllPatternLists();
      expect(stored.map((l) => l.id)).toEqual([survivor.id]);
      await expect(
        AsyncStorage.getItem(patternsKey(doomed.id)),
      ).resolves.toBeNull();
    });

    it("clears the active list pointer when the active list is deleted", async () => {
      const list = createTestPatternList();
      await savePatternList(list);
      await setActiveListId(list.id);

      await deletePatternList(list.id);

      await expect(getActiveListId()).resolves.toBeNull();
    });

    it("removes the list's manual graph layout too", async () => {
      // Same leak as an orphaned pattern key: nothing would ever read or
      // delete it again.
      const doomed = createTestPatternList();
      await savePatternList(doomed);
      await saveGraphLayout(doomed.id, {
        version: 1,
        positions: { "1": { x: 0, y: 0 } },
        updatedAt: 1,
      });

      await deletePatternList(doomed.id);

      await expect(loadGraphLayout(doomed.id)).resolves.toBeNull();
    });

    it("leaves another list's graph layout alone", async () => {
      const doomed = createTestPatternList();
      const survivor = createTestPatternList();
      await savePatternList(doomed);
      await savePatternList(survivor);
      const layout = {
        version: 1,
        positions: { "1": { x: 5, y: 5 } },
        updatedAt: 1,
      };
      await saveGraphLayout(survivor.id, layout);

      await deletePatternList(doomed.id);

      await expect(loadGraphLayout(survivor.id)).resolves.toEqual(layout);
    });

    it("leaves the active list pointer alone when a different list is deleted", async () => {
      const active = createTestPatternList();
      const other = createTestPatternList();
      await savePatternList(active);
      await savePatternList(other);
      await setActiveListId(active.id);

      await deletePatternList(other.id);

      await expect(getActiveListId()).resolves.toBe(active.id);
    });
  });

  describe("active list management", () => {
    it("round-trips the active list id", async () => {
      await setActiveListId("test-id");

      await expect(getActiveListId()).resolves.toBe("test-id");
    });

    it("resolves the active list object", async () => {
      const list = createTestPatternList();
      await savePatternList(list);
      await setActiveListId(list.id);

      await expect(getActiveList()).resolves.toMatchObject({ id: list.id });
    });

    it("resolves to null when no list is active", async () => {
      await expect(getActiveList()).resolves.toBeNull();
    });

    it("resolves to null when the active id points at a deleted list", async () => {
      await setActiveListId("ghost");

      await expect(getActiveList()).resolves.toBeNull();
    });
  });

  describe("pattern management", () => {
    it("round-trips patterns for a list", async () => {
      const patterns = [
        createTestPattern("type1", { id: 1 }),
        createTestPattern("type2", { id: 2 }),
      ];

      await savePatterns("list-id", patterns);

      await expect(loadPatterns("list-id")).resolves.toHaveLength(2);
    });

    it("keeps each list's patterns separate", async () => {
      await savePatterns("a", [createTestPattern("type1", { id: 1 })]);
      await savePatterns("b", [
        createTestPattern("type1", { id: 1 }),
        createTestPattern("type1", { id: 2 }),
      ]);

      await expect(loadPatterns("a")).resolves.toHaveLength(1);
      await expect(loadPatterns("b")).resolves.toHaveLength(2);
    });

    it("returns an empty array for a list with no stored patterns", async () => {
      await expect(loadPatterns("unknown")).resolves.toEqual([]);
    });

    it("drops prerequisite ids whose pattern is gone", async () => {
      // What a build that deleted a pattern without scrubbing it left behind.
      // Such a node could not be laid out in the network graph at all, so the
      // repair happens on read rather than waiting for the next write.
      seedAsyncStorage({
        [patternsKey("l")]: JSON.stringify([
          createTestPattern("type1", { id: 2, prerequisites: [1] }),
          createTestPattern("type1", { id: 3, prerequisites: [2, 99] }),
        ]),
      });

      const loaded = await loadPatterns("l");

      expect(loaded[0].prerequisites).toEqual([]);
      expect(loaded[1].prerequisites).toEqual([2]);
    });

    it("leaves healthy prerequisites untouched", async () => {
      await savePatterns("l", [
        createTestPattern("type1", { id: 1, prerequisites: [] }),
        createTestPattern("type1", { id: 2, prerequisites: [1] }),
      ]);

      const loaded = await loadPatterns("l");

      expect(loaded.map((p) => p.prerequisites)).toEqual([[], [1]]);
    });

    it("defaults `modifierRefs` for patterns written before modifiers existed", async () => {
      const legacy = createTestPattern("type1", { id: 1 });
      delete (legacy as Partial<typeof legacy>).modifierRefs;
      seedAsyncStorage({ [patternsKey("l")]: JSON.stringify([legacy]) });

      const [result] = await loadPatterns("l");

      expect(result.modifierRefs).toEqual([]);
    });
  });

  describe("hasPatternLists", () => {
    it("is true when at least one list exists", async () => {
      await savePatternList(createTestPatternList());

      await expect(hasPatternLists()).resolves.toBe(true);
    });

    it("is false when none exist", async () => {
      await expect(hasPatternLists()).resolves.toBe(false);
    });
  });

  describe("clearAllData", () => {
    it("removes lists, the active pointer, and every per-list pattern key", async () => {
      const a = createTestPatternList();
      const b = createTestPatternList();
      await savePatternList(a);
      await savePatternList(b);
      await savePatterns(a.id, [createTestPattern("type1", { id: 1 })]);
      await savePatterns(b.id, [createTestPattern("type1", { id: 1 })]);
      await saveGraphLayout(a.id, {
        version: 1,
        positions: { "1": { x: 0, y: 0 } },
        updatedAt: 1,
      });
      await setActiveListId(a.id);

      await clearAllData();

      await expect(AsyncStorage.getAllKeys()).resolves.toEqual([]);
    });

    it("is safe to call when storage is already empty", async () => {
      await expect(clearAllData()).resolves.toBeUndefined();
    });
  });

  /**
   * The storage helpers deliberately swallow failures and hand back a safe
   * default, so that a corrupt or unavailable store degrades into "no data"
   * rather than crashing the app on launch. The writers are the exception:
   * they rethrow, because a caller that thinks it saved and did not is worse
   * than a visible failure.
   */
  describe("failure handling", () => {
    const failRead = () =>
      jest
        .spyOn(AsyncStorage, "getItem")
        .mockRejectedValue(new Error("storage unavailable"));

    it("loadAllPatternLists degrades to an empty array", async () => {
      failRead();
      await expect(loadAllPatternLists()).resolves.toEqual([]);
    });

    it("loadPatterns degrades to an empty array", async () => {
      failRead();
      await expect(loadPatterns("any")).resolves.toEqual([]);
    });

    it("getActiveListId degrades to null", async () => {
      failRead();
      await expect(getActiveListId()).resolves.toBeNull();
    });

    it("getActiveList degrades to null", async () => {
      failRead();
      await expect(getActiveList()).resolves.toBeNull();
    });

    it("getPatternListById degrades to null", async () => {
      failRead();
      await expect(getPatternListById("any")).resolves.toBeNull();
    });

    it("collectOrphanedPatternKeys degrades to reclaiming nothing", async () => {
      jest
        .spyOn(AsyncStorage, "getAllKeys")
        .mockRejectedValue(new Error("storage unavailable"));
      await expect(collectOrphanedPatternKeys()).resolves.toBe(0);
    });

    it("savePatternList rethrows so the caller cannot assume success", async () => {
      jest
        .spyOn(AsyncStorage, "setItem")
        .mockRejectedValue(new Error("disk full"));

      await expect(savePatternList(createTestPatternList())).rejects.toThrow(
        "disk full",
      );
    });

    it("savePatterns rethrows so the caller cannot assume success", async () => {
      jest
        .spyOn(AsyncStorage, "setItem")
        .mockRejectedValue(new Error("disk full"));

      await expect(savePatterns("list", [])).rejects.toThrow("disk full");
    });

    it("setActiveListId rethrows", async () => {
      jest
        .spyOn(AsyncStorage, "setItem")
        .mockRejectedValue(new Error("disk full"));

      await expect(setActiveListId("id")).rejects.toThrow("disk full");
    });

    it("deletePatternList rethrows", async () => {
      jest
        .spyOn(AsyncStorage, "setItem")
        .mockRejectedValue(new Error("disk full"));

      await expect(deletePatternList("id")).rejects.toThrow("disk full");
    });

    it("clearAllData rethrows", async () => {
      jest
        .spyOn(AsyncStorage, "removeMany")
        .mockRejectedValue(new Error("disk full"));

      await expect(clearAllData()).rejects.toThrow("disk full");
    });
  });

  describe("collectOrphanedPatternKeys", () => {
    it("removes pattern keys whose list no longer exists", async () => {
      const live = createTestPatternList();
      await savePatternList(live);
      await savePatterns(live.id, [createTestPattern("type1", { id: 1 })]);
      // A key left behind by a list that was deleted without its patterns.
      seedAsyncStorage({ [patternsKey("ghost")]: JSON.stringify([]) });

      const reclaimed = await collectOrphanedPatternKeys();

      expect(reclaimed).toBe(1);
      await expect(
        AsyncStorage.getItem(patternsKey("ghost")),
      ).resolves.toBeNull();
      await expect(loadPatterns(live.id)).resolves.toHaveLength(1);
    });

    it("leaves unrelated keys alone", async () => {
      seedAsyncStorage({ [ACTIVE_KEY]: "something", "@someOtherKey": "x" });

      await collectOrphanedPatternKeys();

      await expect(AsyncStorage.getItem(ACTIVE_KEY)).resolves.toBe("something");
      await expect(AsyncStorage.getItem("@someOtherKey")).resolves.toBe("x");
    });

    it("reports zero when there is nothing to reclaim", async () => {
      const list = createTestPatternList();
      await savePatternList(list);
      await savePatterns(list.id, []);

      await expect(collectOrphanedPatternKeys()).resolves.toBe(0);
    });
  });
});
