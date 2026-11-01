# Settings, import and export

The Settings screen (the drawer's second entry) holds the app's look, its language, moving lists
between phones, the on-device models, what's new and the legal pages. Settings live outside any
list, so deleting every list keeps them.

## What the user can do

### Look

- **Theme**: Light, Dark or System default.
- **Style**: _After Hours_ (the default; warm and roomy, for practising and socials) or
  _Clipboard_ (dense and structured, for running a course). Each has a light and a dark theme
  and its own typefaces.
- **Compact list**: each figure on one line, its type a coloured dot.
- **App icon**: indigo (the default), amber or coral, independent of the style. Changing it
  closes the app. Offered only where the phone supports alternate icons.

### Language

- Nine languages: English, 中文, हिन्दी, Español, Français, العربية, বাংলা, Português, Deutsch. Each
  row shows the language's own name and its English name.
- A fresh install follows the phone's language (a regional variant falls back to its base
  language), else English. Once the user picks one, that choice is kept, even if the phone's
  language changes later.
- On screen the app says _figure_ (de _Figur_, es and pt _figura_) and _list owner_. Dance terms
  in templates and the example list stay in English.

### Export and import

These are for **backups and moving to a new phone**. Sharing a list with others is done by
publishing it ([sharing](sharing.md)), not by sending files.

- **Export** picks lists, then options: _Include Videos_ (phone videos are embedded in the file;
  links always survive), _Export as Read-only_ and _Include transcripts_ (offered only when a
  selected list has one, off each time, and only with videos). The file goes to the phone's
  share menu.
- An editable export carries a published list's share key, so the owner keeps control on the new
  phone. A read-only export does not.
- **Import** validates the whole file before writing anything.
  - Damage that can be repaired (a dangling prerequisite, an unknown type, a malformed video, a
    rhythm that doesn't match its counts) is fixed and listed as a warning.
  - Damage that can't (not an export, no lists, a list without an id, duplicate ids, a file from
    a newer app version) refuses the whole import, with the reason.
- A list that is already on the phone can be **skipped** (the default), **replaced**, or imported
  as a **copy** under a new name. A new list whose name is taken shows its name field, so two lists
  never share a name unseen.
- A summary says how many lists were imported and skipped.

### On-device models

Lists the speech and suggestion models with their size, and downloads or deletes each
([video tools](video-tools.md)). Android only.

### What's new

- After an update, the app shows the notes of every version the user has not seen yet, once.
  Nothing shows on a fresh install.
- _What's new_ lists every version's notes, bundled with the app, in all nine languages.
- _Show what's new after an update_ turns the note off.

### Legal

Links to the terms of use and the privacy policy on the website.

## Rules that must always hold

| Rule                                                                                 | Guarded by                                              |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| Every user-facing string exists in all nine languages, with matching placeholders    | `__tests__/unit/i18n.test.ts`                           |
| A picked language outranks the phone's, permanently                                  | `__tests__/unit/languagePersistence.test.ts`            |
| An export round-trips every field, for every supported format version                | `__tests__/unit/ExportImportRoundTrip.test.ts`          |
| A file from a newer version is refused, never half-imported                          | `__tests__/unit/validateExportData.test.ts`             |
| Conflicting lists default to skip, and nothing is replaced without the user's choice | `__tests__/components/useImportDecisions.test.ts`       |
| A copy import gets a new id and no share code                                        | `__tests__/unit/importCopy.test.ts`                     |
| Each release's notes exist in all nine languages and the newest is the app's version | `__tests__/unit/changelog.test.ts`                      |
| Stored data is migrated once, forwards only, before anything reads it                | `__tests__/unit/migrations.test.ts`                     |

## Not built yet

- Arabic text reads correctly but the layout is not mirrored right to left.

## Code

`src/settings/AGENTS.md`, `src/common/theme/AGENTS.md`, `src/changelog/AGENTS.md`,
`src/pattern/data/AGENTS.md` (export format, validation, migrations), `src/legal/AGENTS.md`.

## Decisions

None recorded yet. Candidate: export files are for backups and new phones, never for sharing
(Oliver, 2026-10-25).
