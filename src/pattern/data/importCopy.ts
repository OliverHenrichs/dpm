import { generateUUID } from "@/src/pattern/types/PatternType";
import { PatternListWithPatterns } from "@/src/pattern/data/types/IExportData";

/** Two list names the user would take for the same: trimmed, in any case. */
export function sameListName(a: string, b: string): boolean {
  return a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();
}

/**
 * `name` with the next number no list in `taken` has: "Salsa" → "Salsa (2)", or "Salsa (3)"
 * when that is taken too. A name that already ends in a number counts on from its base, so a
 * copy of "Salsa (2)" is "Salsa (3)", not "Salsa (2) (2)".
 */
export function nextFreeListName(name: string, taken: string[]): string {
  const base = name.trim().replace(/\s*\(\d+\)$/, "") || name.trim();
  for (let n = 2; ; n++) {
    const candidate = `${base} (${n})`;
    if (!taken.some((t) => sameListName(t, candidate))) return candidate;
  }
}

/**
 * An imported list as a new list beside the one already on the device: a fresh id, its own
 * name, and no tie to a published list (no share code, no share key), as after unpublishing.
 * Pattern ids, type ids and modifier ids are scoped to their list (`@patterns_{listId}`), so
 * they come along unchanged and every reference inside the list still resolves.
 */
export function importedListCopy(
  list: PatternListWithPatterns,
  name: string,
  now: number = Date.now(),
): PatternListWithPatterns {
  const { shareCode: _code, shareKey: _key, ...rest } = list;
  return { ...rest, id: generateUUID(), name, updatedAt: now };
}
