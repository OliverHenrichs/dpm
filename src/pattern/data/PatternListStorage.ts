import AsyncStorage from "@react-native-async-storage/async-storage";
import { IPattern, IPatternList } from "@/src/pattern/types/IPatternList";

// ---------------------------------------------------------------------------
// Migration helpers — ensure old data without the modifiers fields still works
// ---------------------------------------------------------------------------

function normalizePatternList(list: IPatternList): IPatternList {
  return {
    ...list,
    modifiers: list.modifiers ?? [],
  };
}

function normalizePattern(pattern: IPattern): IPattern {
  return {
    ...pattern,
    modifierRefs: pattern.modifierRefs ?? [],
  };
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
  try {
    const lists = await loadAllPatternLists();
    const existingIndex = lists.findIndex((l) => l.id === list.id);

    if (existingIndex >= 0) {
      // Update existing list
      lists[existingIndex] = { ...list, updatedAt: Date.now() };
    } else {
      // Add new list
      lists.push({ ...list, updatedAt: Date.now() });
    }

    await AsyncStorage.setItem(PATTERN_LISTS_KEY, JSON.stringify(lists));
  } catch (error) {
    console.error("Error saving pattern list:", error);
    throw error;
  }
}

export async function deletePatternList(listId: string): Promise<void> {
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
      return parsed.map(normalizePattern);
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
  try {
    await AsyncStorage.setItem(
      getPatternsKey(listId),
      JSON.stringify(patterns),
    );
  } catch (error) {
    console.error("Error saving patterns:", error);
    throw error;
  }
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
    await AsyncStorage.multiRemove([PATTERN_LISTS_KEY, ACTIVE_LIST_ID_KEY]);
    // Note: Individual pattern keys are cleaned up when lists are deleted
  } catch (error) {
    console.error("Error clearing all data:", error);
    throw error;
  }
}
