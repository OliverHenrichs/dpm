import { useCallback, useMemo } from "react";
import {
  IModifier,
  IPattern,
  IPatternList,
  NewModifier,
  NewPattern,
} from "@/src/pattern/types/IPatternList";
import { generateUUID, PatternType } from "@/src/pattern/types/PatternType";
import { useActivePatternList } from "@/src/pattern/data/components/ActivePatternListContext";
import { syncPublishedList } from "@/src/firebase/FirebaseListService";
import { repairDanglingPrerequisites } from "@/src/pattern/graph/utils/GenericGraphUtils";

/**
 * Every mutation returns whether it was applied, so callers can keep a form
 * open on rejection instead of guessing. A `false` is an ordinary refusal — a
 * read-only list, a blank name — not an error; genuine failures surface as a
 * rejected promise from the storage layer.
 */
export interface PatternCrud {
  activeList: IPatternList | null;
  patterns: IPattern[];
  patternTypes: PatternType[];
  modifiers: IModifier[];
  isReadonly: boolean;
  addPattern: (pattern: NewPattern) => Promise<boolean>;
  editPattern: (pattern: NewPattern | IPattern) => Promise<boolean>;
  deletePattern: (id?: number) => Promise<boolean>;
  addModifier: (modifier: NewModifier | IModifier) => Promise<boolean>;
  editModifier: (modifier: NewModifier | IModifier) => Promise<boolean>;
  deleteModifier: (modifierId: string) => Promise<boolean>;
}

/** Next free pattern id. Ids are unique within a list, not across lists. */
export function createNewId(patterns: IPattern[]): number {
  return patterns.length > 0 ? Math.max(...patterns.map((p) => p.id)) + 1 : 1;
}

/**
 * Pattern and modifier mutations for the active list.
 *
 * Pulled out of `PatternListManager`, which held seven of these inline next to
 * seven pieces of modal state. Three of them repeated the same
 * "and push to Firestore if this list is published" block, and the read-only
 * guard was restated in each one. Here both live in exactly one place, and the
 * logic is testable without rendering a screen.
 */
export function usePatternCrud(): PatternCrud {
  const { activeList, patterns, updatePatterns, updateActiveList } =
    useActivePatternList();

  // `?? []` would hand back a fresh array on every render, which would change
  // the identity of every callback below and undo the memoisation.
  const patternTypes = useMemo(
    () => activeList?.patternTypes ?? [],
    [activeList],
  );
  const modifiers = useMemo(() => activeList?.modifiers ?? [], [activeList]);
  const isReadonly = !!activeList?.readonly;

  /**
   * Published lists are kept in step opportunistically: fire the write, don't
   * await it, and never let a sync failure fail the local edit. The local
   * write has already happened by this point.
   */
  const syncIfPublished = useCallback(
    (updatedPatterns: IPattern[]) => {
      if (activeList?.shareCode) {
        syncPublishedList(activeList, updatedPatterns).catch(() => {});
      }
    },
    [activeList],
  );

  const commitPatterns = useCallback(
    async (updatedPatterns: IPattern[]) => {
      await updatePatterns(updatedPatterns);
      syncIfPublished(updatedPatterns);
    },
    [updatePatterns, syncIfPublished],
  );

  const addPattern = useCallback(
    async (pattern: NewPattern) => {
      if (isReadonly || !pattern.name.trim()) return false;
      const newPattern: IPattern = { ...pattern, id: createNewId(patterns) };
      await commitPatterns([...patterns, newPattern]);
      return true;
    },
    [isReadonly, patterns, commitPatterns],
  );

  const editPattern = useCallback(
    async (pattern: NewPattern | IPattern) => {
      if (isReadonly || !pattern.name.trim()) return false;
      if (!("id" in pattern)) {
        console.error("Cannot edit pattern without id");
        return false;
      }
      await commitPatterns(
        patterns.map((p) => (p.id === pattern.id ? (pattern as IPattern) : p)),
      );
      return true;
    },
    [isReadonly, patterns, commitPatterns],
  );

  const deletePattern = useCallback(
    async (id?: number) => {
      if (isReadonly || id === undefined) return false;
      // Drop the pattern *and* every reference to it, the way deleteModifier
      // scrubs modifierRefs. A left-behind prerequisite id is not cosmetic:
      // the network layout cannot place a node whose prerequisites are not all
      // positioned, so the dependent — and its whole subtree — would vanish
      // from the graph with no error. See AGENTS.md, "Prerequisite integrity".
      await commitPatterns(
        repairDanglingPrerequisites(patterns.filter((p) => p.id !== id)),
      );
      return true;
    },
    [isReadonly, patterns, commitPatterns],
  );

  const addModifier = useCallback(
    async (modifier: NewModifier | IModifier) => {
      if (!activeList || isReadonly || !modifier.name.trim()) return false;
      const newModifier: IModifier = { ...modifier, id: generateUUID() };
      await updateActiveList({
        ...activeList,
        modifiers: [...modifiers, newModifier],
      });
      return true;
    },
    [activeList, isReadonly, modifiers, updateActiveList],
  );

  const editModifier = useCallback(
    async (modifier: NewModifier | IModifier) => {
      if (!activeList || isReadonly || !("id" in modifier)) return false;
      if (!modifier.name.trim()) return false;
      await updateActiveList({
        ...activeList,
        modifiers: modifiers.map((m) =>
          m.id === modifier.id ? (modifier as IModifier) : m,
        ),
      });
      return true;
    },
    [activeList, isReadonly, modifiers, updateActiveList],
  );

  const deleteModifier = useCallback(
    async (modifierId: string) => {
      if (!activeList || isReadonly) return false;
      const updatedList = {
        ...activeList,
        modifiers: modifiers.filter((m) => m.id !== modifierId),
      };
      // Scrub the modifier from every pattern that attached it.
      const updatedPatterns = patterns.map((p) => ({
        ...p,
        modifierRefs: (p.modifierRefs ?? []).filter(
          (ref) => ref.modifierId !== modifierId,
        ),
      }));
      await updateActiveList(updatedList, updatedPatterns);
      await updatePatterns(updatedPatterns);
      return true;
    },
    [
      activeList,
      isReadonly,
      modifiers,
      patterns,
      updateActiveList,
      updatePatterns,
    ],
  );

  return {
    activeList,
    patterns,
    patternTypes,
    modifiers,
    isReadonly,
    addPattern,
    editPattern,
    deletePattern,
    addModifier,
    editModifier,
    deleteModifier,
  };
}
