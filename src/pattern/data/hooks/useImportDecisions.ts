import { useCallback, useMemo, useState } from "react";
import { IPatternList } from "@/src/pattern/types/IPatternList";
import { PatternListWithPatterns } from "@/src/pattern/data/types/IExportData";

export type ImportAction = "skip" | "replace";

export interface ImportDecision {
  list: IPatternList;
  action: ImportAction;
  existingList?: IPatternList;
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
  // instead of skipped.
  const [overrides, setOverrides] = useState<Map<string, ImportAction>>(
    () => new Map(),
  );

  const decisions = useMemo(() => {
    const map = new Map<string, ImportAction>();
    importedLists.forEach((list) => {
      map.set(
        list.id,
        overrides.get(list.id) ?? defaultAction(list, existingLists),
      );
    });
    return map;
  }, [importedLists, existingLists, overrides]);

  const setAction = useCallback((listId: string, action: ImportAction) => {
    setOverrides((prev) => new Map(prev).set(listId, action));
  }, []);

  const getImportDecisions = useCallback(
    (): ImportDecision[] =>
      importedLists.map((list) => ({
        list,
        action: overrides.get(list.id) ?? defaultAction(list, existingLists),
        existingList: existingLists.find((e) => e.id === list.id),
      })),
    [importedLists, existingLists, overrides],
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
    getImportDecisions,
    stats,
  };
};
