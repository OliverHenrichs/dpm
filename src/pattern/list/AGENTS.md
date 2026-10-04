# Pattern list & modifiers — `src/pattern/list/`

Screens and forms for managing patterns, modifiers, tags and videos. Unqualified paths below
are relative to `src/pattern/list/`.

## Mutations go through `usePatternCrud`

Pattern and modifier **mutations** go through `usePatternCrud` (`hooks/usePatternCrud.ts`), not
through `ActivePatternListContext` directly. It owns the read-only guard, id allocation, the
prerequisite scrub on delete and the opportunistic Firestore push, and every mutation returns
whether it was applied so a caller can keep a form open on rejection. `PatternListManager` is
left holding only which modal is open. Add a mutation there, not inline in a screen.

`PatternListManager` calls `syncPublishedList(activeList, patterns)` after pattern CRUD when a
`shareCode` exists — see `src/firebase/AGENTS.md`.

## Modifiers

Modifiers are affixes ("with a spin", "slow") that live on the list, not on a pattern:

- **Universal** modifiers implicitly apply to every pattern in the list and carry their own `videoRefs`.
- **Non-universal** modifiers are attached per-pattern through `IPattern.modifierRefs`; each attachment carries its own videos of that specific combination.

`PatternListManager` has a `patterns` / `modifiers` tab switch and owns modifier CRUD (`addModifier`, `editModifier`, `deleteModifier` — deleting also scrubs the id from every pattern's `modifierRefs`). UI: `ModifierList` → `ModifierListItem` → `ModifierDetails`, editing via `EditModifierForm`; `ModifierPillStrip` renders/toggles a pattern's modifiers inside `EditPatternForm` and `PatternDetails`.

## Sorting

`SortConfig` (`SortBottomSheet.tsx`): `{ field, order }` with
`SortField = "name" | "typeId" | "level" | "counts" | "id"` and `SortOrder = "asc" | "desc"`,
applied by `usePatternSort` over the pure `sortPatterns` in `hooks/patternSections.ts`. Types sort
in the list's own order and levels from beginner to advanced; a pattern without a value goes last
whichever way the sort runs. Sorting by type, level or counts splits the list into sections
(`buildListEntries`), each under a pinned `PatternSectionHeader` with a count; name and date added
stay one list. `PatternList` renders the entries in one `FlatList` with `stickyHeaderIndices`, so a
reveal must look its pattern up among the entries, not among the patterns. The sheet renders
through the shared `BottomSheet` (`src/common/components/BottomSheet.tsx`).

A row shows the pattern's type and level (when set) and how many videos it has; counts and the
rest wait in the opened details. Level is optional throughout: the form starts without one,
tapping the chosen level clears it (removing the key, since Firestore rejects `undefined`), and
details and the graph legend leave it out when unset.

## Always-mounted modals must not snapshot props

`SettingsScreen` mounts `PatternListImportModal` permanently and only toggles `visible`, so a
hook behind it first runs with empty data and the real data arrives as a prop change. Derive
from props on every read, or key the body so it remounts — `PatternListTemplateModal` takes the
second route, keying on what the modal is open on so opening it re-seeds drafts fresh. What is
not correct is snapshotting once with a lazy `useState` initialiser and leaving it. The import
side of this is written up in `src/pattern/data/AGENTS.md`.

## Rhythm

A pattern's optional `rhythm` is written the way dancers count it (`src/pattern/rhythm/rhythm.ts`): `3` a step, `3&4` or `3a4` a triple, `(4)` a beat without a weight change, beats running from 1 without gaps. It **always matches `counts`**, both ways, in `EditPatternForm`: typing a valid rhythm sets the counts, and changing the counts drops a rhythm that no longer fits. Text that is not yet a rhythm stays in the field with an explanation and is not saved. While the field is empty, whole rhythms are suggested from the list's `dance` (`rhythmSuggestions`: the dance's basic rhythms for those counts, then a step on every beat). Below them, `nextRhythmSteps` offers the next step to append (a step, a triple, a swung triple, a held beat); the form's scroll views keep the keyboard up on those taps (`keyboardShouldPersistTaps`), so typing can go on. Only add a dance's rhythm when it is the standard one; Argentine tango deliberately has none. The dance is chosen in the list's setup (`PatternListTemplateModal`), where a template presets it.
