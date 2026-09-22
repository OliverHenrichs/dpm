import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  GRAPH_LAYOUT_VERSION,
  StoredGraphLayout,
} from "@/src/pattern/graph/model/resolveLayout";
import {
  getGraphLayoutKey,
  GRAPH_LAYOUT_KEY_PREFIX,
} from "@/src/pattern/graph/data/GraphLayoutKeys";

export { getGraphLayoutKey };

/**
 * Is this a layout we wrote, in a shape we still understand?
 *
 * Deliberately strict about the envelope and forgiving about its contents:
 * `resolveLayout` already ignores an entry that is not a point, so a single
 * corrupt coordinate costs one node's position rather than the whole layout.
 */
function isStoredLayout(value: unknown): value is StoredGraphLayout {
  if (typeof value !== "object" || value === null) return false;
  const layout = value as Partial<StoredGraphLayout>;
  return (
    typeof layout.version === "number" &&
    layout.version <= GRAPH_LAYOUT_VERSION &&
    typeof layout.positions === "object" &&
    layout.positions !== null &&
    !Array.isArray(layout.positions)
  );
}

/**
 * A list's manual graph layout, or null if it has none.
 *
 * Null is the normal answer, not an error: most lists have never been
 * arranged by hand, and the graph falls back to the automatic layout. Every
 * failure — missing key, unparseable JSON, a version from a future build —
 * returns null for the same reason, which is the contract every other storage
 * helper here follows: a read never throws, it degrades.
 */
export async function loadGraphLayout(
  listId: string,
): Promise<StoredGraphLayout | null> {
  try {
    const raw = await AsyncStorage.getItem(getGraphLayoutKey(listId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isStoredLayout(parsed) ? parsed : null;
  } catch (error) {
    console.error("Error loading graph layout:", error);
    return null;
  }
}

/**
 * Persist a list's manual layout.
 *
 * No write lock, unlike `savePatternList`: this is a whole-value write of a
 * key only the graph screen touches, not a read-modify-write over a shared
 * array, so two overlapping saves cannot lose each other's data — the later
 * one simply wins, which is what the user just did.
 */
export async function saveGraphLayout(
  listId: string,
  layout: StoredGraphLayout,
): Promise<void> {
  try {
    await AsyncStorage.setItem(
      getGraphLayoutKey(listId),
      JSON.stringify(layout),
    );
  } catch (error) {
    console.error("Error saving graph layout:", error);
    throw error;
  }
}

/** Forget a list's manual layout, so the graph lays itself out again. */
export async function clearGraphLayout(listId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(getGraphLayoutKey(listId));
  } catch (error) {
    console.error("Error clearing graph layout:", error);
    throw error;
  }
}

/**
 * Remove `@graphLayout_{listId}` entries whose list no longer exists.
 *
 * The same leak as `collectOrphanedPatternKeys` guards against: a key nothing
 * would ever read or delete again. Returns the number reclaimed.
 */
export async function collectOrphanedLayoutKeys(
  liveListIds: string[],
): Promise<number> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const liveKeys = new Set(liveListIds.map(getGraphLayoutKey));
    const orphaned = allKeys.filter(
      (key) => key.startsWith(GRAPH_LAYOUT_KEY_PREFIX) && !liveKeys.has(key),
    );
    if (orphaned.length > 0) await AsyncStorage.removeMany(orphaned);
    return orphaned.length;
  } catch (error) {
    console.error("Error collecting orphaned layout keys:", error);
    return 0;
  }
}
