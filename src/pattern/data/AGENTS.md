# Pattern data — `src/pattern/data/`

Storage, id allocation, migrations, the shared list context, and the import/export format.
Unqualified paths are relative to `src/pattern/data/`.

## Persistence (AsyncStorage)

| Key | Holds | Owner |
|---|---|---|
| `@patternLists` | `IPatternList[]`, **without** patterns | `PatternListStorage.ts` |
| `@patterns_{listId}` | `IPattern[]` of one list | `PatternListStorage.ts` |
| `@activeListId` | the active list's UUID | `PatternListStorage.ts` |
| `@schemaVersion` | the migrated data's version | `migrations/index.ts` |
| `@graphLayout_{listId}` | a user-arranged network layout | `src/pattern/graph/data/` |
| `@language`, `@theme`, `@appStyle` | settings | `src/settings/data/` |
| `@graphDragHintDismissed` | the drag hint was dismissed | `src/pattern/graph/data/GraphHintStorage.ts` |

Settings live under their own keys, outside any list, so they survive deleting every list.

- **UI code never calls `AsyncStorage`.** Use the helpers in `PatternListStorage.ts`
  (`loadAllPatternLists`, `savePatternList`, `deletePatternList`, `getPatternListById`,
  `getActiveListId` / `setActiveListId`, `getActiveList`, `loadPatterns`, `savePatterns`,
  `hasPatternLists`, `clearAllData`, `collectOrphanedPatternKeys`), and in screens the context
  (`components/ActivePatternListContext.tsx`) rather than those.
- **Writes to the same key are serialised.** `savePatternList` and `deletePatternList` are
  read-modify-write over the whole array, and two overlapping calls used to lose the first's change
  (`PatternListSelector.handleSaveList` and the context's `updateActiveList` can overlap).
  `withWriteLock` queues the **entire operation**, read included. Reads are not queued, so a locked
  operation can read without deadlocking itself.
- **`@patternLists` holds lists without patterns.** Import and cloud subscribe hand over a
  `PatternListWithPatterns`, whose extra `patterns` TypeScript cannot see on `IPatternList`, so
  `savePatternList` strips it and `loadAllPatternLists` strips it again from records an older build
  bloated. Do not "simplify" that away: it would store a second, stale copy of every pattern.
- `savePatternList` also owns the share key (`src/firebase/AGENTS.md`): present exactly when the
  list has a `shareCode` and is not `readonly`.
- `clearAllData` removes the two top-level keys and every `@patterns_*` and `@graphLayout_*` key.
  `collectOrphanedPatternKeys` reclaims `@patterns_*` entries whose list is gone; it runs once,
  unawaited, after the provider's first load and must never delay or fail first paint.
- **Read-time repair stays even with migrations**: `loadPatterns` normalises shape and scrubs
  dangling prerequisites (`src/pattern/graph/AGENTS.md`, "Prerequisite integrity"), because imports
  and cloud syncs arrive after migrations have run.

## Pattern ids

`IPatternList.nextPatternId` is a high-water mark and `nextPatternId(list, patterns)`
(`patternIds.ts`) is the only way to mint an id. `usePatternCrud` keeps the mark ahead of every id
the list has used, measured before _and_ after each write so a delete cannot lower it. The
allocator also takes `max(id) + 1`, so a missing or corrupt mark cannot collide; that is why there
is no migration. Ids used to be `max(id) + 1`, unique at any instant but not over time, and the
manual layout then gave a deleted pattern's position to whichever pattern inherited its id.

## Migrations

Stored data carries `@schemaVersion`, and `runMigrations()` (`migrations/`) brings it to
`SCHEMA_VERSION` **before anything reads pattern data**: it is awaited first in
`ActivePatternListProvider`'s mount effect, behind the loading state.

To add one: bump `SCHEMA_VERSION`, add it to `MIGRATIONS`, and make it **idempotent** (a crash
part-way leaves the marker unchanged, so it runs again). Migrations never run backwards: a stored
version ahead of the build (an older APK over a newer one) runs nothing and leaves the marker, since
downgrading would discard what the newer build added. A failed migration is logged and does not
block startup. Existing: 001 normalises shape; 002 re-saves every list so lists published before
share keys existed get one.

## Import validation

**Never trust an import file**: it comes from a document picker, and everything downstream writes
it to storage and the screen. `validateExportData` (`validation/`) is the only gate, and
`ImportPatterns` calls it before touching anything.

- **Fatal** (the whole file is refused, since a half-import leaves the user unable to tell what
  landed): not an object, an unsupported version, `patternLists` not an array, a list with no id, a
  non-integer pattern id, duplicate ids.
- **Repairable** (cleaned, reported as a warning, import proceeds): a type not in its list, a
  prerequisite matching no pattern, a malformed video reference, transcript or `generated` field,
  a rhythm that does not match its counts, an unknown dance.

What it returns is normalised (optional fields filled, references resolvable); nothing downstream
re-checks it.

**Problems are i18n keys, not English.** `errors` and `warnings` are `ImportMessage`s
(`{ key, params?, context? }`, `validation/importMessages.ts`), rendered with
`formatImportMessages(t, …)`; `context` names the list and pattern or modifier. A new message needs
a key in `IMPORT_MESSAGE_KEYS` and all nine locales; the keys are chosen at runtime, so the static
`t("…")` scan cannot see them and `__tests__/unit/importMessages.test.ts` checks them instead.

**Conflicts.** `useImportDecisions` (`ImportAction = "skip" | "replace"` per list) derives each
default from props on every read (`skip` when the id exists locally, `replace` when not) and keeps
only the user's explicit choices in state. It once snapshotted defaults in a lazy `useState`, which
ran while the always-mounted modal still had empty data, so every conflicting list was silently
replaced. See "Always-mounted modals" in `src/pattern/list/AGENTS.md`.

## Export / import format

Version `"3.4.0"`: `exportDataVersion` and `IPatternListExportData` in `types/IExportData.ts`:

```ts
{ version, exportDate, includesVideos, includesTranscripts?, patternLists: PatternListWithPatterns[], videos: { [localPath]: base64 } }
```

- `canImport` (`types/ExportVersion.ts`) owns compatibility, separately from what we write. A newer
  **minor** is refused rather than parsed best-effort: saving over a field this build cannot carry
  would silently drop the user's data. **Bumping the format means bumping `exportDataVersion`,
  `SUPPORTED_MINOR`, adding a case to `__tests__/unit/ExportImportRoundTrip.test.ts`, and a line
  below.**
- `exportPatternLists(lists, { includeVideos, exportAsReadonly, includeTranscripts })`
  (`exportPatterns.ts`) writes the file and hands it to `expo-sharing`. Without `includeVideos`
  local refs are dropped (URL refs survive); `exportAsReadonly` marks each list `readonly`. Videos
  are keyed by their **original local path**: pattern, universal-modifier and modifier-combination
  videos alike.
- `importPatternLists()` (`ImportPatterns.ts`) picks a file, validates it, decodes the videos back
  into the document directory, and warns (never fails) on a missing or unreadable video. A relocated
  ref is spread, so its other fields survive.
- Picked videos go through `persistVideo` / `persistPickedVideos` (`videoFiles.ts`), which copy them
  into the document directory: the picker hands out cache URIs the OS may clear.
- The UI is `components/PatternListExportModal` and `PatternListImportModal` with their row
  components, backed by `hooks/useExportSelection` and `hooks/useImportDecisions`;
  `src/settings/hooks/useDataTransfer.ts` runs the flow from `SettingsScreen`.

Version history (what each minor added):

- **3.1** `IVideoReference.generated` (`{ method, createdAt }`), provenance of a video the app made.
  A malformed one is dropped with a warning, never the video.
- **3.2** `IVideoReference.transcript`. **Left out unless `includeTranscripts`**, the export sheet's
  opt-in: offered only when a selected list has a transcript, off each time the sheet opens, and
  needs `includeVideos`. Malformed lines are dropped with a warning, a malformed transcript is
  dropped whole, never the video. Published lists never carry transcripts (`withoutTranscripts` in
  `transcripts.ts`).
- **3.3** `IPattern.rhythm` (kept only when it matches the counts, else
  `importWarnRhythmMismatch`) and `IPatternList.dance` (kept only when this build knows it).
- **3.4** `IPatternList.shareKey`. An editable export carries it, so importing on a new phone hands
  over control of the published list; a read-only export leaves it out.

## Shared list context

`components/ActivePatternListContext.tsx` (`ActivePatternListProvider`, `useActivePatternList`)
holds the active list and its patterns, runs migrations then the first load, and calls
`useSharedList` (`hooks/useSharedList.ts`) for a subscribed list's live updates. `updateActiveList`
pushes a published list to Firestore; pass `patternsOverride` when patterns changed in the same
step, or it pushes the pre-change snapshot.

## Default list templates

`DefaultPatternLists.ts`: `createWestCoastSwingList`, `createSalsaList`, `createBachataList`,
`createTangoList`, `createLindyHopList`, `createBlankList`, each a fresh `IPatternList` with UUID
types and no modifiers; every template but blank sets `dance`. `TEMPLATE_FOUNDATIONAL_PATTERNS`
maps a template id to starter patterns, and `resolveTemplatePatterns` resolves their `typeSlug` to
`typeId` (stable across renames) and gives each the dance's basic rhythm for its counts. Templates
are picked in `PatternListTemplateModal`. Dance content must be accurate: real pattern names,
verified terms, variations as modifiers rather than patterns.
