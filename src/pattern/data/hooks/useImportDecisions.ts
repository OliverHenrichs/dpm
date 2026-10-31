import { useCallback, useMemo, useState } from "react";
import { IPatternList } from "@/src/pattern/types/IPatternList";
import { PatternListWithPatterns } from "@/src/pattern/data/types/IExportData";
import { nextFreeListName, sameListName } from "@/src/pattern/data/importCopy";

/**
 * `replace` writes the imported list under its own id (over the local one when the id exists);
 * `copy` writes it as a new list beside the local one (`importedListCopy`); `skip` leaves it.
 */
export type ImportAction = "skip" | "replace" | "copy";

export interface ImportDecision {
  list: IPatternList;
  action: ImportAction;
  existingList?: IPatternList;
  /** The name the list is saved under: the user's, else the default for its action. */
  name: string;
}

interface UseImportDecisionsProps {
  importedLists: PatternListWithPatterns[];
  existingLists: IPatternList[];
}

/**
 * A list already on the device defaults to `skip`: the local copy may carry
 * edits the imported file does not, and replacing it cannot be undone.
 * Anything new defaults to `replace`, which here just means "write it".
 */
function defaultAction(
  list: PatternListWithPatterns,
  existingLists: IPatternList[],
): ImportAction {
  return existingLists.some((e) => e.id === list.id) ? "skip" : "replace";
}

export const useImportDecisions = ({
  importedLists,
  existingLists,
}: UseImportDecisionsProps) => {
  // Only what the user has explicitly chosen is state. The defaults are
  // derived from the props on every read.
  //
  // They used to be snapshotted into state by a lazy `useState` initialiser,
  // which looked fine but never ran with real data: the modal is mounted
  // permanently by SettingsScreen and only toggles `visible`, so the hook
  // first ran with an empty list and the real one arrived later as a prop
  // change. The map stayed empty, every lookup fell through to its
  // `|| "replace"` fallback, and a conflicting list was silently overwritten
  // instead of skipped. Names follow the same rule.
  const [overrides, setOverrides] = useState<Map<string, ImportAction>>(
    () => new Map(),
  );
  const [names, setNames] = useState<Map<string, string>>(() => new Map());

  const actionOf = useCallback(
    (list: PatternListWithPatterns) =>
      overrides.get(list.id) ?? defaultAction(list, existingLists),
    [overrides, existingLists],
  );

  const decisions = useMemo(() => {
    const map = new Map<string, ImportAction>();
    importedLists.forEach((list) => map.set(list.id, actionOf(list)));
    return map;
  }, [importedLists, actionOf]);

  /**
   * Whether the list's name can be edited, and what it starts as: a copy gets "Name (2)" (the
   * next free number); a new list whose name another list already has keeps it unless renamed,
   * so two lists never end up with one name without the user seeing it. Otherwise no field.
   */
  const nameFieldOf = useCallback(
    (list: PatternListWithPatterns): { defaultName: string } | null => {
      const action = actionOf(list);
      if (action === "copy") {
        const taken = [
          ...existingLists.map((e) => e.name),
          ...importedLists.filter((l) => l.id !== list.id).map((l) => l.name),
        ];
        return { defaultName: nextFreeListName(list.name, taken) };
      }
      const isNew = !existingLists.some((e) => e.id === list.id);
      if (
        action === "replace" &&
        isNew &&
        existingLists.some((e) => sameListName(e.name, list.name))
      ) {
        return { defaultName: list.name };
      }
      return null;
    },
    [actionOf, existingLists, importedLists],
  );

  /** The name field's text: what the user typed, else its default. */
  const nameOf = useCallback(
    (list: PatternListWithPatterns): string => {
      const field = nameFieldOf(list);
      if (!field) return list.name;
      return names.get(list.id) ?? field.defaultName;
    },
    [nameFieldOf, names],
  );

  const setAction = useCallback((listId: string, action: ImportAction) => {
    setOverrides((prev) => new Map(prev).set(listId, action));
    // A name typed for one action is no default for another ("Salsa (2)" is no rename).
    setNames((prev) => {
      const next = new Map(prev);
      next.delete(listId);
      return next;
    });
  }, []);

  const setName = useCallback((listId: string, name: string) => {
    setNames((prev) => new Map(prev).set(listId, name));
  }, []);

  const getImportDecisions = useCallback(
    (): ImportDecision[] =>
      importedLists.map((list) => {
        const typed = nameOf(list).trim();
        return {
          list,
          action: actionOf(list),
          existingList: existingLists.find((e) => e.id === list.id),
          // Blank is no name: fall back to the field's default.
          name: typed || (nameFieldOf(list)?.defaultName ?? list.name),
        };
      }),
    [importedLists, existingLists, actionOf, nameOf, nameFieldOf],
  );

  const stats = useMemo(() => {
    const conflictCount = importedLists.filter((list) =>
      existingLists.some((e) => e.id === list.id),
    ).length;
    const totalPatternsCount = importedLists.reduce(
      (sum, list) => sum + list.patterns.length,
      0,
    );
    return {
      conflictCount,
      totalPatternsCount,
      totalLists: importedLists.length,
    };
  }, [importedLists, existingLists]);

  return {
    decisions,
    setAction,
    nameFieldOf,
    nameOf,
    setName,
    getImportDecisions,
    stats,
  };
};
