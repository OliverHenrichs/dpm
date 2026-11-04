import {
  applyReplacements,
  applySequenceReplacements,
} from "@/src/anonymize/jobs/replaceVideo";
import { useCallback, useMemo } from "react";
import {
  IModifier,
  IPattern,
  IPatternList,
  ISequence,
  NewModifier,
  NewPattern,
} from "@/src/pattern/types/IPatternList";
import {
  blankFreeStep,
  cleanSequence,
  freeStepsOf,
  MAX_SEQUENCES,
  withoutVariant,
  withSequences,
} from "@/src/pattern/sequences/sequences";
import {
  generateUUID,
  isSlugUnique,
  normalizeSlug,
  PATTERN_TYPE_COLORS,
  PatternType,
} from "@/src/pattern/types/PatternType";
import { useActivePatternList } from "@/src/pattern/data/components/ActivePatternListContext";
import { syncPublishedList } from "@/src/firebase/FirebaseListService";
import { repairDanglingPrerequisites } from "@/src/pattern/graph/utils/GenericGraphUtils";
import { nextPatternId } from "@/src/pattern/data/patternIds";
import {
  applyLevelMoves,
  applyTypeMoves,
  LevelMoves,
  TypeMoves,
} from "@/src/pattern/list/typeMoves";
import {
  applyTagEdits,
  NO_TAG_EDITS,
  TagEdits,
} from "@/src/pattern/list/tagEdits";

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
  sequences: ISequence[];
  isReadonly: boolean;
  addPattern: (pattern: NewPattern) => Promise<boolean>;
  editPattern: (pattern: NewPattern | IPattern) => Promise<boolean>;
  deletePattern: (id?: number) => Promise<boolean>;
  addModifier: (modifier: NewModifier | IModifier) => Promise<boolean>;
  editModifier: (modifier: NewModifier | IModifier) => Promise<boolean>;
  deleteModifier: (modifierId: string) => Promise<boolean>;
  /**
   * Adds the sequence, or replaces the one with its id, as `cleanSequence` makes it. False for a
   * read-only list, a blank name, a free step without text, or a new one past `MAX_SEQUENCES`.
   */
  saveSequence: (sequence: ISequence) => Promise<boolean>;
  deleteSequence: (sequenceId: string) => Promise<boolean>;
  /** The new type, or null for a read-only list, a blank name or one already used. */
  addPatternType: (name: string) => Promise<PatternType | null>;
  /** Recolours one type (the Map's legend); false for a read-only list or an unknown type. */
  setPatternTypeColor: (typeId: string, color: string) => Promise<boolean>;
  /**
   * Saves the timeline's lanes as the user dragged them (type ids, top to bottom), or with
   * `undefined` goes back to the automatic order. False for a read-only list.
   */
  setLaneOrder: (order: string[] | undefined) => Promise<boolean>;
  /**
   * Saves the list's own settings (name, types, dance, levels), edited where its patterns are.
   * `typeMoves` reassigns the figures of each removed type to the type that takes them, and
   * `levelMoves` those of each removed level to another level or none; `tagEdits` renames,
   * merges and deletes tags on every figure.
   */
  saveList: (
    list: IPatternList,
    typeMoves?: TypeMoves,
    levelMoves?: LevelMoves,
    tagEdits?: TagEdits,
  ) => Promise<boolean>;
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
  const sequences = useMemo(() => activeList?.sequences ?? [], [activeList]);
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

      // Keep the high-water mark ahead of every id this list has ever used.
      // Measured over the patterns *before* the change as well as after, or a
      // delete would lower it and hand the departed pattern's id straight back
      // out. Written second, and only when it actually moves: losing the mark
      // is recoverable — `nextPatternId` falls back to the patterns present —
      // whereas losing the patterns is not.
      if (!activeList) return;
      const mark = Math.max(
        nextPatternId(activeList, patterns),
        nextPatternId(activeList, updatedPatterns),
      );
      if (mark !== activeList.nextPatternId) {
        // Hand over the new patterns: for a published list this also pushes,
        // and without them it pushed the provider's pre-change snapshot —
        // overwriting the push above, so an added pattern was lost.
        await updateActiveList(
          { ...activeList, nextPatternId: mark },
          updatedPatterns,
        );
      }
    },
    [updatePatterns, syncIfPublished, activeList, patterns, updateActiveList],
  );

  const addPattern = useCallback(
    async (pattern: NewPattern) => {
      if (isReadonly || !pattern.name.trim()) return false;
      const newPattern: IPattern = {
        ...applyReplacements(pattern),
        id: nextPatternId(activeList, patterns),
        createdAt: Date.now(),
      };
      await commitPatterns([...patterns, newPattern]);
      return true;
    },
    [isReadonly, patterns, commitPatterns, activeList],
  );

  const editPattern = useCallback(
    async (pattern: NewPattern | IPattern) => {
      if (isReadonly || !pattern.name.trim()) return false;
      if (!("id" in pattern)) {
        console.error("Cannot edit pattern without id");
        return false;
      }
      // A draft opened before an anonymization job finished still holds the original
      // video; saving it must not put the original back.
      const updated = applyReplacements(pattern as IPattern);
      await commitPatterns(
        patterns.map((p) => (p.id === updated.id ? updated : p)),
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
      // from the graph with no error. See src/pattern/graph/AGENTS.md, "Prerequisite integrity".
      const remaining = repairDanglingPrerequisites(
        patterns.filter((p) => p.id !== id),
      );
      // Steps of the figure in a sequence become free steps with its name, so the sequence
      // keeps its shape. The list goes first: should the patterns' write fail, the figure is
      // still there beside free steps of its name, rather than steps pointing at nothing.
      const pattern = patterns.find((p) => p.id === id);
      const freed =
        activeList && pattern
          ? freeStepsOf(activeList.sequences, pattern, modifiers)
          : activeList?.sequences;
      if (activeList && freed !== activeList.sequences) {
        const mark = Math.max(
          nextPatternId(activeList, patterns),
          nextPatternId(activeList, remaining),
        );
        await updateActiveList(
          {
            ...withSequences(activeList, freed),
            nextPatternId: mark,
            updatedAt: Date.now(),
          },
          remaining,
        );
        await updatePatterns(remaining);
        return true;
      }
      await commitPatterns(remaining);
      return true;
    },
    [
      isReadonly,
      patterns,
      commitPatterns,
      activeList,
      modifiers,
      updateActiveList,
      updatePatterns,
    ],
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
      // Steps danced with it become the plain figure.
      const updatedList = withSequences(
        {
          ...activeList,
          modifiers: modifiers.filter((m) => m.id !== modifierId),
        },
        withoutVariant(activeList.sequences, modifierId),
      );
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

  const saveSequence = useCallback(
    async (sequence: ISequence) => {
      if (!activeList || isReadonly || !sequence.name.trim()) return false;
      if (sequence.steps.some(blankFreeStep)) return false;
      const exists = sequences.some((s) => s.id === sequence.id);
      if (!exists && sequences.length >= MAX_SEQUENCES) return false;
      // A draft opened before a job on its video finished still holds the original video (and
      // its marks before the cut); saving it must not put them back. The others too: this
      // callback may hold the list from before the job's swap.
      const cleaned = cleanSequence(
        applySequenceReplacements(sequence),
        patterns,
        modifiers,
      );
      await updateActiveList({
        ...withSequences(
          activeList,
          exists
            ? sequences.map((s) =>
                s.id === cleaned.id ? cleaned : applySequenceReplacements(s),
              )
            : [...sequences.map(applySequenceReplacements), cleaned],
        ),
        updatedAt: Date.now(),
      });
      return true;
    },
    [activeList, isReadonly, sequences, patterns, modifiers, updateActiveList],
  );

  const deleteSequence = useCallback(
    async (sequenceId: string) => {
      if (!activeList || isReadonly) return false;
      if (!sequences.some((s) => s.id === sequenceId)) return false;
      await updateActiveList({
        ...withSequences(
          activeList,
          sequences.filter((s) => s.id !== sequenceId),
        ),
        updatedAt: Date.now(),
      });
      return true;
    },
    [activeList, isReadonly, sequences, updateActiveList],
  );

  const addPatternType = useCallback(
    async (name: string) => {
      const slug = normalizeSlug(name);
      if (!activeList || isReadonly || !slug) return null;
      if (!isSlugUnique(slug, patternTypes)) return null;
      // The first palette colour no type has yet, as the list editor picks it.
      const palette = Object.values(PATTERN_TYPE_COLORS) as string[];
      const used = new Set(patternTypes.map((type) => type.color));
      const type: PatternType = {
        id: generateUUID(),
        slug,
        color: palette.find((c) => !used.has(c)) ?? palette[0],
      };
      await updateActiveList({
        ...activeList,
        patternTypes: [...patternTypes, type],
      });
      return type;
    },
    [activeList, isReadonly, patternTypes, updateActiveList],
  );

  const setPatternTypeColor = useCallback(
    async (typeId: string, color: string) => {
      if (!activeList || isReadonly) return false;
      if (!patternTypes.some((type) => type.id === typeId)) return false;
      await updateActiveList({
        ...activeList,
        patternTypes: patternTypes.map((type) =>
          type.id === typeId ? { ...type, color } : type,
        ),
        updatedAt: Date.now(),
      });
      return true;
    },
    [activeList, isReadonly, patternTypes, updateActiveList],
  );

  const setLaneOrder = useCallback(
    async (order: string[] | undefined) => {
      if (!activeList || isReadonly) return false;
      // Back to automatic removes the key rather than setting it to `undefined`: the list is
      // published as it is, and Firestore refuses `undefined`.
      const { laneOrder: _previous, ...rest } = activeList;
      await updateActiveList({
        ...rest,
        ...(order?.length && { laneOrder: order }),
        updatedAt: Date.now(),
      });
      return true;
    },
    [activeList, isReadonly, updateActiveList],
  );

  const saveList = useCallback(
    async (
      list: IPatternList,
      typeMoves: TypeMoves = {},
      levelMoves: LevelMoves = {},
      tagEdits: TagEdits = NO_TAG_EDITS,
    ) => {
      if (!activeList || isReadonly || list.id !== activeList.id) return false;
      // Figures first, so none is left on a removed type or level if the list write is what
      // fails; the list's push to Firestore then carries the moved figures with it.
      const moved = applyTagEdits(
        applyLevelMoves(applyTypeMoves(patterns, typeMoves), levelMoves),
        tagEdits,
      );
      if (moved !== patterns) await updatePatterns(moved);
      await updateActiveList(list, moved);
      return true;
    },
    [activeList, isReadonly, patterns, updatePatterns, updateActiveList],
  );

  return {
    activeList,
    patterns,
    patternTypes,
    modifiers,
    sequences,
    isReadonly,
    addPattern,
    editPattern,
    deletePattern,
    addModifier,
    editModifier,
    deleteModifier,
    saveSequence,
    deleteSequence,
    addPatternType,
    setPatternTypeColor,
    setLaneOrder,
    saveList,
  };
}
