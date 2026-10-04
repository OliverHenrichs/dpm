import type { Migration } from "./index";
import {
  loadAllPatternLists,
  savePatternList,
} from "@/src/pattern/data/PatternListStorage";

/**
 * Give every list this device publishes a share key.
 *
 * Lists published before share keys existed have a `shareCode` and no key.
 * `savePatternList` mints the missing key (and drops a stray one from a
 * read-only copy), so re-saving every list is the whole migration. It has to
 * happen up front rather than at the next save: a pattern edit saves only the
 * patterns, yet syncs the published list, and that sync needs the key.
 *
 * Idempotent: a list that already has its key keeps it.
 */
export const migration002ShareKeys: Migration = {
  version: 2,
  description: "Give published lists a share key",
  run: async () => {
    for (const list of await loadAllPatternLists()) {
      await savePatternList(list);
    }
  },
};
