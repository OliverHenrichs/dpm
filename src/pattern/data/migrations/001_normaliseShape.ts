import type { Migration } from "./index";
import {
  loadAllPatternLists,
  loadPatterns,
  savePatternList,
  savePatterns,
} from "@/src/pattern/data/PatternListStorage";

/**
 * Write every stored list and pattern back in the current shape.
 *
 * Three fixes have so far been applied on *read*, which means every launch
 * pays for them and the bad data stays on disk indefinitely:
 *
 *  - `modifiers` / `modifierRefs` defaulted to `[]` when written before
 *    modifiers existed;
 *  - a `patterns` array duplicated into the list record by the import and
 *    cloud-subscribe paths (AGENT_TASKS.md B10);
 *  - prerequisite ids left pointing at deleted patterns, which made those
 *    patterns disappear from the network graph (B1).
 *
 * Saving each record back through the storage helpers applies all three once
 * and for good. The read-time repairs stay — they still protect against data
 * arriving from an import or a cloud sync after this has run — but they stop
 * being the only thing standing between the user and a corrupted list.
 *
 * Idempotent: running it on already-clean data rewrites identical content.
 */
export const migration001NormaliseShape: Migration = {
  version: 1,
  description: "Normalise stored lists and patterns to the current shape",
  run: async () => {
    // Both helpers repair as they load, so re-saving what they return is the
    // whole migration.
    const lists = await loadAllPatternLists();
    for (const list of lists) {
      const patterns = await loadPatterns(list.id);
      await savePatterns(list.id, patterns);
      await savePatternList(list);
    }
  },
};
