# The List tab's toolbars

How the List tab sets apart what changes the list, what its followers do and how it is shown,
the same on all three segments: Figures, Modifiers and Sequences. What the segments hold is in
[lists and figures](lists-and-figures.md) and [sequences](sequences.md).

## What the user can do

- **The list itself**: its settings open from the edit-list button beside the menu in the
  header (not on a read-only list). Each segment's toolbar ends on **+** at the right, or a lock
  on a read-only list.
- **Followers**: a published list shows a band above the segments. The owner sees _Members_ on a
  members-only list (_Asking to join_ with the number when someone is waiting) and _Suggestions_
  with the number to review while suggestions are on or any are left. A follower who may
  suggest sees _Suggest a figure_. An unpublished list has no band ([sharing](sharing.md)).
- **The view**: each segment's toolbar starts with two chips: the sort in force (its field and
  direction) and _Filter_, which counts the criteria that are set (_Filter · 2_) and is outlined
  in the success colour while any is. The segment control names the list, so there is no title.

### Sorting and filtering

- **Figures** sort by name (the default), type, level, counts or date added, ascending or
  descending. Every sort except name splits the list into sections with pinned headers and
  counts. Types follow the list's order, levels the list's order (easiest first), and figures
  without a value come last. A figure whose level the list no longer has counts as no level.
- **Figures** filter by name, type, level, exact counts and tags. The same filter applies to the
  List and the Map.
- **Modifiers** sort by name, position or date added (the default: the order they were made). By
  position they follow dancing order (_Entry_, _During_, _Exit_) under a header for each. They
  filter by name, position and kind (_Universal_ or _Attached to figures_).
- **Sequences** sort by name, date added (the default), total counts or number of steps, and
  filter by name, by a figure they contain (part of its name) and by having a video.
- Picking the sort in force again flips its direction. Sorts and filters are not remembered:
  each segment's are gone once another segment is shown or the user leaves the list.

## Rules that must always hold

| Rule                                                                      | Guarded by                                                     |
| ------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Figure sorts keep the list's order of types and levels, unset values last | `__tests__/unit/patternSections.test.ts`                       |
| Modifiers by position follow dancing order, with a header per position    | `__tests__/unit/modifierView.test.ts`, `listToolbars.test.tsx` |
| Sequences by total counts use the totals their rows show                  | `__tests__/unit/sequenceView.test.ts`                          |
| The filter chip counts each criterion that is set once                    | `__tests__/unit/modifierView.test.ts`, `sequenceView.test.ts`  |
| The band shows only an action the list has; none on an unpublished list   | `__tests__/components/listToolbars.test.tsx`                   |

## Not built yet

- The Map and Reels tabs keep their own controls; only the List tab has this toolbar.
- Sorts and filters are not remembered across segments or visits.

## Code

`src/pattern/list/AGENTS.md` (the List tab's layout, sorting and rows),
`src/pattern/suggestions/AGENTS.md`, `src/pattern/members/AGENTS.md`.

## Decisions

- [0012](../decisions/0012-list-tab-actions-apart.md) The List tab keeps the list, its followers
  and its view apart
