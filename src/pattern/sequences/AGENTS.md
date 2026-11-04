# Sequences — `src/pattern/sequences/`

Named runs of a list's figures in dancing order (#136): `IPatternList.sequences`, shown on the
List tab's third segment. What the user sees is `docs/product/sequences.md`; the design for the
phases still to come (a video per sequence, the Map) is `docs/plans/sequences.md`.

- **Model** (`src/pattern/types/IPatternList.ts`): a sequence has an id, name, optional
  description, steps and `createdAt`; a step is
  `{ kind: "figure", id, patternId, modifierId?, note? }` or
  `{ kind: "free", id, text, counts?, note? }`. Step ids keep two steps of one figure apart when
  reordered. Optional fields are **absent, never `undefined` or empty** (the list is published as
  it is): `cleanSequence` makes a sequence so on save, `withSequences` drops the key with the last
  one.
- **Pure logic is `sequences.ts`**, shared by the UI, `usePatternCrud` and `normalizeList`:
  caps (`MAX_SEQUENCES` 50, `MAX_SEQUENCE_STEPS` 200, text lengths), `stepVariants` (attached,
  then universal, as `ModifierPillStrip`), `stepCounts` (via `effectiveVariant`, so a variant's
  own counts count), `sequenceTotals` (eights only for `EIGHT_COUNT_DANCES`), `freeStepsOf` and
  `withoutVariant` for deletes.
- **Counts are never stored on a figure step**: they come from the figure or variant, so a
  changed figure changes every total. A variant the figure no longer has (detached, or no longer
  universal) shows as the plain figure and is dropped on the next save.
- **Mutations go through `usePatternCrud`** (`saveSequence`, `deleteSequence`); `deletePattern`
  writes the list (free steps) before the patterns, and `deleteModifier` scrubs the variant.
  The caps are the app's: the security rules don't enforce them.
- **`SequenceModal` mounts its own `GestureHandlerRootView`**: the step grips are Gesture Handler
  pans, which never activate inside a `Modal` without one (`src/common/AGENTS.md`).
- **Drag reorder** (`useStepDrag.ts`): one pan per grip, activating at once (`minDistance(0)`).
  The rows don't reflow during a drag: the dragged row follows the finger as a transform and the
  rows it passes make way by its height, so no view moves under a gesture; React hears of it at
  pick-up (`holding`, which stops the form's scroller) and drop only. Row centres come from
  `onLayout` and are captured by each gesture as data, and the drop target is `laneIndexAt` (a
  worklet). **No arrow functions inside these worklets**: the React Compiler hoists them off the
  UI thread (`src/pattern/graph/AGENTS.md`). Jest drives the handlers through the mock
  (`sequences.test.tsx`); arbitration with the scroller is a device check.
- Long press on a step duplicates it, but only as a shortcut beside the copy button
  (`src/common/ui/AGENTS.md`).
