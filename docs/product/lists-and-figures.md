# Lists and figures

A list is one dancer's or one course's collection of figures. Each figure names the figures it
builds on, and carries its counts, rhythm, level, tags, videos and modifiers. Everything here
works offline and stays on the phone unless the user shares it.

## What the user can do

### Lists

- The **Lists** screen (the drawer's first entry, and the home button) shows every list on the
  phone. The drawer lists them too, so the user can switch lists from anywhere.
- With no lists yet, the screen offers **Explore an example** and **Start my own list**. The
  example is a West Coast Swing list of eight figures from two beginner courses and a festival,
  with prerequisites, modifiers and tags. It opens on the Map. It has no videos.
- **Creating a list** starts from a template or from _Blank_. Templates: West Coast Swing, Salsa,
  Bachata, Brazilian Zouk, Argentine Tango and Lindy Hop. A template brings its figure types, a
  few starter figures (the user can untick any) and the dance. The West Coast Swing template also
  brings six modifiers: with Inside Turn, with Outside Turn, with Free Spin, with Duck, Hesitation
  and with Hand Change.
- The name field is not focused on its own, so the keyboard doesn't hide the setup.
- A list's **dance** picks the basic rhythms the form suggests and the dance terms transcription
  listens for. It can be _None_.
- **Editing a list** (from the Lists screen or the List tab) changes its name, dance, types and
  levels. Dance, Figure Types, Levels and Starting Figures fold: open for a new list, closed with
  a one-line summary when editing one (a folded section with a problem shows the problem). Save
  and Cancel stay pinned below. Each type in use says how many figures use it. Removing a type in
  use asks which type its figures move to. The only type cannot be removed while figures use it.
- A list has its own **levels**, easiest first, up to 12. A new list has Beginner, Intermediate
  and Advanced. The presets _Beginner / Intermediate / Advanced_, _Numbers_ (1, 2, 3 …) and _Own
  names_ rename the levels in place by position, so figures keep their step. Levels can be
  renamed (non-empty, unique ignoring case), moved up or down, added and removed. Removing a level
  in use asks where its figures go: another level or _No level_. The last level cannot go. An
  untouched list keeps the built-in names in the app's language.
- A type's **colour** comes from a fixed palette, picked in the list settings or from the Map's
  legend.
- **Deleting a list** asks first. A read-only list cannot be edited or deleted, only unsubscribed
  (see [sharing](sharing.md)).
- The list that was open stays open after a restart.

### Figures (the List tab)

- **+** offers _New figure_, _From a video_ (picked from the gallery) and _Record a video_ (the
  system camera). A video seeds the new figure, and after saving the app offers to edit the video
  ([video tools](video-tools.md)).
- A figure has a **name** (required: Save stays grey until there is one), a **type**, optional
  **level** (one of the list's levels; tapping the chosen level again clears it),
  **counts**, an optional **rhythm**, a **description**, **tags**, **prerequisites**, up to 10
  **videos** and **modifiers**.
- The form can add a **new type** from its type picker.
- **Tags and prerequisites** are picked the same way: what the figure has comes first, then the
  rest by how often the list uses them, with a fuzzy search. A typed tag nobody has yet is offered
  as _Create "…"_. Figures that would close a prerequisite loop are greyed out and cannot be
  picked.
- Save and Cancel stay pinned below the form while it scrolls.
- **Videos** are local files (copied into the app's storage, so the system cannot clear them) or
  links with an optional start time. Thumbnails show in the form and in the details.
- A row shows the figure's type, level and number of videos. Tapping it expands the details:
  description, videos, prerequisites, what it builds into, tags and modifiers.
- **Compact list** (a setting) puts each figure on one line, its type a coloured dot.
- **Deleting a figure** asks first and removes it from every other figure's prerequisites.
- The List tab has a second segment, **Modifiers**.

### Rhythm and counts

- A rhythm is written the way dancers count: `1 2 3&4 5&6`. `3&4` is a triple, `3a4` a swung
  triple, `3&4&5` a rolling count, `(4)` a beat with no weight change.
- **A rhythm always matches its counts.** Typing a valid rhythm sets the counts. Changing the
  counts drops a rhythm that no longer fits. Text that isn't a rhythm yet is explained and not
  saved.
- While the rhythm is empty, the form offers the dance's basic rhythms for those counts. Bubbles
  add the next step, extend the last triple, or undo, so a rhythm can be built without the
  keyboard. The rhythm section is folded by default.

### Modifiers

- A modifier changes how a figure is danced ("with inside turn", "hesitation"). It belongs to the
  list. Its position is _Entry_, _During_ or _Exit_, and it has an optional one-sentence
  description.
- A **universal** modifier applies to every figure and carries its own videos, managed in the
  Modifiers tab.
- A **non-universal** modifier is attached to single figures. Each attachment is a _variant_ with
  its own videos of that figure danced with that modifier.
- In the details, picking a variant shows its videos and description. A modifier's own details
  list every figure it's attached to. Deleting a modifier detaches it everywhere.
- A variation of a figure is a modifier on it, not a new figure.

### Sorting and filtering

- **Sort** by name, type, level, counts or date added, ascending or descending. Every sort except
  name splits the list into sections with pinned headers and counts. Types follow the list's
  order, levels the list's order (easiest first), and figures without a value come last. A
  figure whose level the list no longer has counts as no level.
- **Filter** by name, type, level, exact counts and tags. The same filter applies to the List and
  the Map. Filters are not remembered when the user leaves the list.

## Rules that must always hold

| Rule                                                                      | Guarded by                                                                    |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Figure ids are never reused, even after a delete                          | `__tests__/unit/patternIds.test.ts`, `usePatternCrud.test.ts`                 |
| Deleting a figure leaves no dangling prerequisite anywhere                | `__tests__/unit/PrerequisiteIntegrity.test.ts`, `PatternListManager.test.tsx` |
| Prerequisites can never form a loop through the editor                    | `__tests__/components/EditPatternForm.test.tsx`                               |
| A stored rhythm always matches its counts                                 | `__tests__/unit/rhythm.test.ts`                                               |
| Every mutation is refused on a read-only list                             | `__tests__/components/usePatternCrud.test.ts`                                 |
| A refused save keeps the form as the user left it                         | `__tests__/components/PatternListManager.test.tsx`                            |
| Removing a type moves its figures first                                   | `__tests__/unit/typeMoves.test.ts`                                            |
| Removing a level moves its figures first, to a level or to none           | `__tests__/unit/typeMoves.test.ts`, `PatternListTemplateModal.test.tsx`       |
| A list has at most 12 levels, with non-empty unique names                 | `__tests__/unit/patternLevels.test.ts`                                        |
| Presets rename levels in place, so no figure changes level                | `__tests__/unit/patternLevels.test.ts`                                        |
| A level id a list doesn't have shows as no level                          | `__tests__/unit/patternLevels.test.ts`                                        |
| A figure and each of its variants hold at most 10 videos                  | `__tests__/unit/replaceVideo.test.ts`                                         |
| The example list's and templates' prerequisites and modifiers all resolve | `__tests__/unit/exampleList.test.ts`                                          |

## Not built yet

- Tag management ([#133](https://github.com/OliverHenrichs/dpm/issues/133)).
- Counts and rhythm per variant, on attached modifiers only ([#134](https://github.com/OliverHenrichs/dpm/issues/134)).
- Slow/quick notation, `S Q Q` ([#135](https://github.com/OliverHenrichs/dpm/issues/135)).
- Sequences ([#136](https://github.com/OliverHenrichs/dpm/issues/136), design in [`docs/plans/sequences.md`](../plans/sequences.md)).
- Argentine tango has no basic rhythm on purpose.

## Code

`src/pattern/list/AGENTS.md`, `src/pattern/rhythm/AGENTS.md`, `src/pattern/data/AGENTS.md`
(storage, ids, templates, the example list), `src/pattern/types/` and the root `AGENTS.md` (data
model).

## Decisions

- [0005](../decisions/0005-figure-ids-are-never-reused.md) Figure ids are never reused
- [0009](../decisions/0009-variations-are-modifiers.md) Variations are modifiers
