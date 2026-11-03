# Sequences

A sequence is a named, ordered run of a list's figures that someone wants to keep and practise as
a whole: a Standard or Latin routine, a West Coast Swing Rallye routine, a combination learned in
a workshop ([#136](https://github.com/OliverHenrichs/dpm/issues/136)). It lives on its list, so
it travels with export and publishing. Phases 2 (video mapping) and 3 (Map and details) are still
to come; their design is in [`docs/plans/sequences.md`](../plans/sequences.md).

## What the user can do

- The List tab's segments are **Figures · Modifiers · Sequences**, each with a count.
- The **overview** has one row per sequence: name, number of steps and total counts. **+** adds
  one. With none yet, it says what a sequence is: "Figures in the order you dance them: a
  routine, a Rallye, a workshop combination."
- **Opening** a sequence shows its name, totals, description and its steps as a numbered list:
  each with the figure's name and type colour, the variant and the counts, and the step's note.
  **Edit** opens the form in the same sheet; Cancel goes back to the sequence. A new sequence
  opens straight in the form, and Cancel then keeps nothing.
- The form has a **name** (required: Save says so), an optional **description** and the steps.
  Save and Cancel stay pinned below while it scrolls.
- **Add step** opens a picker: a _Free step_ first, then the list's figures grouped by type in
  its colour, by name within a type, with a fuzzy search. Picking one adds it at the end.
- A **figure step** can be danced as a **variant**: a modifier attached to that figure or a
  universal one, picked from the same pill strip as in the figure's details. A figure with
  variants opens its strip under the new step. No pill picked means the plain figure. The step
  shows the variant's counts: its own where it has them, else the figure's. Changing a figure's
  (or variant's) counts changes every sequence's totals.
- A **free step** is text with optional counts, for what isn't a figure on the list ("pose",
  "4 counts improvised", "wait for the vocal"). Save waits for its text.
- Tapping a step opens its variant strip (or free text and counts) and its **note**; folded, the
  note shows under the step. Each step has a **grip** to drag it into a new order (screen readers
  move it one place with _Move up_ / _Move down_), **duplicate** (also a long press: routines
  repeat figures) and **remove**.
- The **totals** are steps and counts. For a salsa or bachata list they also show the length in
  eights ("32 counts · 4 × 8"), only when every step with counts fills whole eights.
- **Deleting a figure** a sequence uses asks first and names those sequences; confirming turns
  its steps into free steps with the figure's name (and variant), counts and note, so each
  sequence keeps its shape. **Deleting a modifier** turns the steps danced with it into the
  plain figure.
- Each row on the overview edits or deletes its sequence; deleting asks first and leaves the
  figures on the list.
- At most **50 sequences** per list and **200 steps** per sequence; + and Add step say so at the
  limit.
- **Read-only lists** (followed, read-only imports) show their sequences, without +, Edit or
  delete.
- Sequences come along in every **export** (also read-only ones) and in the **published** list.

## Rules that must always hold

| Rule                                                                        | Guarded by                                                          |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| A step's counts are its variant's own or its figure's, live                 | `__tests__/unit/sequences.test.ts`, `sequences.test.tsx`            |
| Deleting a figure leaves free steps with its name in its place, never a gap | `__tests__/components/usePatternCrud.test.ts`, `sequences.test.tsx` |
| A step's variant is one its figure has, or none                             | `__tests__/unit/sequences.test.ts`, `ExportImportRoundTrip.test.ts` |
| Import and shared lists drop a step whose figure is missing, and say so     | `__tests__/unit/ExportImportRoundTrip.test.ts`, `sequences.test.ts` |
| At most 50 sequences and 200 steps, on save and on import                   | `__tests__/components/usePatternCrud.test.ts`, `sequences.test.ts`  |
| A list without sequences has no `sequences` key                             | `__tests__/unit/sequences.test.ts`, `usePatternCrud.test.ts`        |
| Sequence changes are refused on a read-only list                            | `__tests__/components/usePatternCrud.test.ts`, `sequences.test.tsx` |
| A published list with sequences is accepted by the security rules           | `__tests__/rules/firestore.rules.test.ts`                           |

## Not built yet

- A video per sequence, marking each step's start and following it while the video plays
  (phase 2).
- "Show sequence" on the Map, and "In: …" under a figure's details (phase 3); with them, the
  picker putting first the figures that followed the last step in the list's other sequences.
- The size limits are kept by the app; the security rules do not enforce them.
- Subscribers cannot suggest sequences, and a sequence cannot span several lists.
- Moving a step by drag does not scroll the form at its edges yet.

## Code

`src/pattern/sequences/AGENTS.md`, `src/pattern/list/AGENTS.md` (`usePatternCrud`),
`src/pattern/data/AGENTS.md` (export format 3.13, import repairs).

## Decisions

None recorded yet. The choices made with Oliver on 2026-10-31 are listed at the end of
[`docs/plans/sequences.md`](../plans/sequences.md).
