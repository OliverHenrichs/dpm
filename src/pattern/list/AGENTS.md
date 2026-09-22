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
applied by `usePatternSort`. Rendered through the shared `BottomSheet`
(`src/common/components/BottomSheet.tsx`).

## Always-mounted modals must not snapshot props

`SettingsScreen` mounts `PatternListImportModal` permanently and only toggles `visible`, so a
hook behind it first runs with empty data and the real data arrives as a prop change. Derive
from props on every read, or key the body so it remounts — `PatternListTemplateModal` takes the
second route, keying on what the modal is open on so opening it re-seeds drafts fresh. What is
not correct is snapshotting once with a lazy `useState` initialiser and leaving it. The import
side of this is written up in `src/pattern/data/AGENTS.md`.
