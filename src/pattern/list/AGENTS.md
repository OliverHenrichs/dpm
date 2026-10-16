# Pattern list & modifiers — `src/pattern/list/`

The _Lists_ screen (`PatternListSelector`), the _List_ tab (`PatternListManager`), and the forms for
patterns, modifiers, tags, videos and sharing. Unqualified paths are relative to
`src/pattern/list/`.

## Mutations go through `usePatternCrud`

Pattern **and** modifier mutations (`addPattern`, `editPattern`, `deletePattern`, `addModifier`,
`editModifier`, `deleteModifier`) live in `hooks/usePatternCrud.ts`, never inline in a screen or
straight on the context. The hook owns, in one place:

- the read-only guard;
- id allocation and the `nextPatternId` high-water mark (`src/pattern/data/AGENTS.md`);
- referential cleanup: deleting a pattern scrubs it from every `prerequisites`
  (`repairDanglingPrerequisites`), deleting a modifier scrubs it from every `modifierRefs`;
- `applyReplacements`, which swaps in a video a finished job replaced while the form was open
  (`src/anonymize/AGENTS.md`);
- the opportunistic Firestore push: when the list has a `shareCode`, `syncPublishedList` fires
  unawaited after the local write and its failure never fails the edit.

Every mutation returns whether it was applied, so a caller can keep a form open on rejection.
`PatternListManager` holds only which tab and modal is open. Add a mutation to the hook.

## Modifiers

The model is in the root `AGENTS.md`. UI: `ModifierList` → `ModifierListItem` → `ModifierDetails`,
edited in `EditModifierForm`; `ModifierPillStrip` shows and toggles a pattern's modifiers in
`EditPatternForm` and `PatternDetails`. A pattern, and each modifier combination of it, holds at
most `MAX_VIDEOS` videos (`src/anonymize/jobs/replaceVideo.ts`).

## Sorting and rows

`SortConfig` (`SortBottomSheet.tsx`): `{ field, order }`, `SortField = "name" | "typeId" | "level" |
"counts" | "id"`, applied by `usePatternSort` over the pure `sortPatterns` in
`hooks/patternSections.ts`. Types sort in the list's own order, levels from beginner to advanced,
and a pattern without a value goes last either way. Sorting by type, level or counts splits the list
into sections (`buildListEntries`) under pinned `PatternSectionHeader`s with counts, and so does
date added, a header per day (`IPattern.createdAt`; undated patterns under their own, and a list
with no dates stays one list); name stays one list. `PatternList` renders the entries in one
`FlatList` with `stickyHeaderIndices`, so a "reveal" (scroll to a pattern) must look the pattern up
among the entries, not the patterns. The `FlatList` is keyed on whether it has sections: Android
painted blank headers when a flat list gained them.

A row shows type, level (when set) and video count; the rest waits in the expanded details
(`PatternDetails`, shared with the graph's modal; see `src/pattern/graph/AGENTS.md`). Level is
optional throughout: tapping the chosen level clears it by **removing the key**, since Firestore
rejects `undefined`. The same goes for any optional field that reaches a published list.

## Always-mounted modals must not snapshot props

Several modals are mounted permanently and only toggle `visible` (`SettingsScreen`'s
`PatternListImportModal`, among others), so a hook behind one first runs with empty data and the
real data arrives later as a prop change. Either derive from props on every read
(`useImportDecisions`), or remount the body so it re-seeds: key it on what the modal is open on
(`PatternListTemplateModal`), or render it only while `visible` (`PatternListExportModal`). Never snapshot once with a lazy `useState`
initialiser: that silently overwrote conflicting lists on import, and opened the export sheet with
nothing selected.

## Forms

- `EditPatternForm` keeps `rhythm` and `counts` in step; the rules are in
  `src/pattern/rhythm/AGENTS.md`. Its scroll views set `keyboardShouldPersistTaps` so taps on
  suggestions keep the keyboard up.
- Tags and prerequisites are picked the same way, inside their folded sections
  (`PatternTags`, `PatternPrerequisites`; order in `pickerOptions.ts`): what the pattern has comes
  first, selected, most recently chosen first (choosing **prepends**, so the stored arrays are in
  that order); the rest follow by how many other patterns of the list use them, then by name,
  with loop-closing prerequisites last. The search narrows the rest with `fuzzyFilter`
  (`src/common/utils/fuzzyMatch.ts`) and never hides what is chosen. A typed tag no pattern has
  is offered as _Create "…"_. Nothing picks tags in a separate sheet any more.
- The pattern list's **+** offers _New pattern_, _From a video_ (gallery) and _Record a video_
  (system camera). The video seeds the new pattern's form; after saving, the app offers to edit it
  (`src/anonymize/AGENTS.md`).
- A local video's tile also offers _Put online_, and a video shared to DPM can open the add form
  through `newVideo` route params (`src/videoLinks/AGENTS.md`).
- `PatternListTemplateModal` creates and sets up a list: template, name, types, dance.
- `ShareListModal` / `SubscribeListModal` are the sharing UI (`src/firebase/AGENTS.md`).
