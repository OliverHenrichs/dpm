import AsyncStorage from "@react-native-async-storage/async-storage";
import { IPattern, IPatternList } from "@/src/pattern/types/IPatternList";
import { repairDanglingPrerequisites } from "@/src/pattern/graph/utils/GenericGraphUtils";

// ---------------------------------------------------------------------------
// Migration helpers — ensure old data without the modifiers fields still works
// ---------------------------------------------------------------------------

/**
 * Coerce a stored record back to the declared `IPatternList` shape.
 *
 * `patterns` is stripped deliberately. The two keys have distinct jobs —
 * `@patternLists` holds lists *without* patterns, `@patterns_{listId}` holds
 * the patterns — but the import and cloud-subscribe paths both hand over a
 * `PatternListWithPatterns`, whose extra `patterns` array the type system does
 * not see because `IPatternList` has no such field. Left alone it is written
 * into `@patternLists` as well, duplicating every pattern and leaving a second
 * copy that nothing reads and nothing keeps in step. Normalising at the
 * storage boundary fixes both directions at once: new writes stay clean, and
 * lists already bloated on a device shed the duplicate as they load.
 */
function normalizePatternList(list: IPatternList): IPatternList {
  const { patterns: _patterns, ...rest } = list as IPatternList & {
    patterns?: unknown;
  };
  return {
    ...rest,
    modifiers: rest.modifiers ?? [],
  };
}

function normalizePattern(pattern: IPattern): IPattern {
  return {
    ...pattern,
    modifierRefs: pattern.modifierRefs ?? [],
  };
}

// ---------------------------------------------------------------------------
// Write serialisation
// ---------------------------------------------------------------------------

/** The tail of the pending write chain for each key. */
const writeChains = new Map<string, Promise<unknown>>();

/**
 * Run `work` after every write already queued for `key` has finished.
 *
 * `savePatternList` and `deletePatternList` are read-modify-write over the
 * whole list array: load all, change one, write all back. Two of those
 * overlapping — entirely possible, since `PatternListSelector.handleSaveList`
 * and the context's `updateActiveList` can both be in flight — and the second
 * one's read happens before the first one's write, so the first change is
 * silently lost.
 *
 * Serialising the *whole* operation, not just its final `setItem`, is what
 * fixes that: the read has to be inside the critical section too. Only
 * mutating helpers queue; reads run freely, which also means a queued
 * operation can safely read without deadlocking against itself.
 */
function withWriteLock<T>(key: string, work: () => Promise<T>): Promise<T> {
  const previous = writeChains.get(key) ?? Promise.resolve();
  // Swallow a previous failure so one rejected write does not poison the
  // queue for every later one; the original caller still sees its own error.
  const result = previous.then(work, work);
  writeChains.set(
    key,
    result.catch(() => undefined),
  );
  return result;
}

// Storage keys
const PATTERN_LISTS_KEY = "@patternLists";
const ACTIVE_LIST_ID_KEY = "@activeListId";
const PATTERNS_KEY_PREFIX = "@patterns_"; // Prefix for pattern storage per list

/**
 * Pattern List Management
 */

export async function loadAllPatternLists(): Promise<IPatternList[]> {
  try {
    const stored = await AsyncStorage.getItem(PATTERN_LISTS_KEY);
    if (stored) {
      const parsed: IPatternList[] = JSON.parse(stored);
      return parsed.map(normalizePatternList);
    }
    return [];
  } catch (error) {
    console.error("Error loading pattern lists:", error);
    return [];
  }
}

export async function savePatternList(list: IPatternList): Promise<void> {
  return withWriteLock(PATTERN_LISTS_KEY, async () => {
    try {
      const lists = await loadAllPatternLists();
      const existingIndex = lists.findIndex((l) => l.id === list.id);

      const normalized = {
        ...normalizePatternList(list),
        updatedAt: Date.now(),
      };
      if (existingIndex >= 0) {
        lists[existingIndex] = normalized;
      } else {
        lists.push(normalized);
      }

      await AsyncStorage.setItem(PATTERN_LISTS_KEY, JSON.stringify(lists));
    } catch (error) {
      console.error("Error saving pattern list:", error);
      throw error;
    }
  });
}

export async function deletePatternList(listId: string): Promise<void> {
  return withWriteLock(PATTERN_LISTS_KEY, async () => {
    try {
      const lists = await loadAllPatternLists();
      const filtered = lists.filter((l) => l.id !== listId);
      await AsyncStorage.setItem(PATTERN_LISTS_KEY, JSON.stringify(filtered));

      // Also delete the patterns for this list
      await AsyncStorage.removeItem(getPatternsKey(listId));

      // If this was the active list, clear active list
      const activeId = await getActiveListId();
      if (activeId === listId) {
        await AsyncStorage.removeItem(ACTIVE_LIST_ID_KEY);
      }
    } catch (error) {
      console.error("Error deleting pattern list:", error);
      throw error;
    }
  });
}

export async function getPatternListById(
  listId: string,
): Promise<IPatternList | null> {
  try {
    const lists = await loadAllPatternLists();
    return lists.find((l) => l.id === listId) || null;
  } catch (error) {
    console.error("Error getting pattern list:", error);
    return null;
  }
}

/**
 * Active List Management
 */

export async function getActiveListId(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(ACTIVE_LIST_ID_KEY);
  } catch (error) {
    console.error("Error getting active list ID:", error);
    return null;
  }
}

export async function setActiveListId(listId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(ACTIVE_LIST_ID_KEY, listId);
  } catch (error) {
    console.error("Error setting active list ID:", error);
    throw error;
  }
}

export async function getActiveList(): Promise<IPatternList | null> {
  try {
    const activeId = await getActiveListId();
    if (!activeId) return null;
    return await getPatternListById(activeId);
  } catch (error) {
    console.error("Error getting active list:", error);
    return null;
  }
}

/**
 * Pattern Management (per list)
 */

function getPatternsKey(listId: string): string {
  return `${PATTERNS_KEY_PREFIX}${listId}`;
}

export async function loadPatterns(listId: string): Promise<IPattern[]> {
  try {
    const stored = await AsyncStorage.getItem(getPatternsKey(listId));
    if (stored) {
      const parsed: IPattern[] = JSON.parse(stored);
      // Self-heal on read: deleting a pattern used to leave its id behind in
      // every pattern that required it, and such a node could not be laid out
      // in the network graph at all. Lists written by those builds are still
      // on people's devices, so repair them as they load. The repaired array
      // persists the next time anything saves.
      return repairDanglingPrerequisites(parsed.map(normalizePattern));
    }
    return [];
  } catch (error) {
    console.error("Error loading patterns:", error);
    return [];
  }
}

export async function savePatterns(
  listId: string,
  patterns: IPattern[],
): Promise<void> {
  return withWriteLock(getPatternsKey(listId), async () => {
    try {
      await AsyncStorage.setItem(
        getPatternsKey(listId),
        JSON.stringify(patterns),
      );
    } catch (error) {
      console.error("Error saving patterns:", error);
      throw error;
    }
  });
}

/**
 * Utility to check if any pattern lists exist
 */
export async function hasPatternLists(): Promise<boolean> {
  const lists = await loadAllPatternLists();
  return lists.length > 0;
}

/**
 * Clear all data (for testing or reset)
 */
export async function clearAllData(): Promise<void> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const patternKeys = allKeys.filter((key) =>
      key.startsWith(PATTERNS_KEY_PREFIX),
    );
    await AsyncStorage.removeMany([
      PATTERN_LISTS_KEY,
      ACTIVE_LIST_ID_KEY,
      ...patternKeys,
    ]);
  } catch (error) {
    console.error("Error clearing all data:", error);
    throw error;
  }
}

/**
 * Remove `@patterns_{listId}` entries whose list no longer exists.
 *
 * Deleting a list removes its pattern key, but a crash between the two writes —
 * or data written by an older build — can leave the key behind, where nothing
 * would ever read or delete it again. Safe to call at any time; returns the
 * number of keys reclaimed.
 */
export async function collectOrphanedPatternKeys(): Promise<number> {
  try {
    const [allKeys, lists] = await Promise.all([
      AsyncStorage.getAllKeys(),
      loadAllPatternLists(),
    ]);
    const liveKeys = new Set(lists.map((list) => getPatternsKey(list.id)));
    const orphaned = allKeys.filter(
      (key) => key.startsWith(PATTERNS_KEY_PREFIX) && !liveKeys.has(key),
    );
    if (orphaned.length > 0) {
      await AsyncStorage.removeMany(orphaned);
    }
    return orphaned.length;
  } catch (error) {
    console.error("Error collecting orphaned pattern keys:", error);
    return 0;
  }
}
