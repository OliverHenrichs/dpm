# Pattern data — `src/pattern/data/`

Storage, id allocation, migrations, and the import/export format. Unqualified paths below
are relative to `src/pattern/data/`.

## Pattern ids are never reused

`IPatternList.nextPatternId` is a high-water mark and `nextPatternId(list, patterns)` in `patternIds.ts` is the only way to mint one; `usePatternCrud` keeps the mark ahead of every id the list has ever used, measured over the patterns before *and* after each write so a delete cannot lower it. They used to be `max(id) + 1` over the patterns present, which is unique at any instant but not over time — the manual graph layout, which outlives individual patterns, then attached a stored position to whichever pattern later inherited the id. The allocator also takes `max(id) + 1` into account, so a missing or corrupt mark can never produce a collision; that is why there is no migration.

## Persistence (AsyncStorage)

Storage keys in `PatternListStorage.ts`:
- `@patternLists` — serialised `IPatternList[]` (no patterns)
- `@patterns_{listId}` — serialised `IPattern[]` for a given list
- `@activeListId` — UUID of the currently active list

App-wide settings live under their own single-purpose keys, outside any list, so they survive deleting every list: `@language` (`src/settings/data/LanguageStorage.ts`), `@theme` (`src/settings/data/ThemeStorage.ts`) and `@graphDragHintDismissed` (`src/pattern/graph/data/GraphHintStorage.ts`).

**Writes to the same key are serialised.** `savePatternList` and `deletePatternList` are
read-modify-write over the whole list array, so two overlapping calls used to both read the
pre-change array and the second silently discarded the first's change — reachable in the app,
since `PatternListSelector.handleSaveList` and the context's `updateActiveList` can be in flight
together. `withWriteLock` queues the **entire operation**, not just its final `setItem`; the read
has to be inside the critical section too. Reads are not queued, so a locked operation can read
freely without deadlocking against itself.

Patterns and lists are stored under **separate keys**. Always use the helpers in `PatternListStorage.ts` (`loadAllPatternLists`, `savePatternList`, `deletePatternList`, `getPatternListById`, `getActiveListId`, `setActiveListId`, `getActiveList`, `loadPatterns`, `savePatterns`, `hasPatternLists`, `clearAllData`, `collectOrphanedPatternKeys`) — never call `AsyncStorage` directly from UI code.

**`@patternLists` holds lists without patterns.** The import and cloud-subscribe paths both hand over a `PatternListWithPatterns`, whose extra `patterns` array TypeScript cannot see because `IPatternList` has no such field — so `savePatternList` strips it rather than trusting callers, and `loadAllPatternLists` strips it again to clean up records an older build already bloated. Do not "simplify" that away: it writes a second copy of every pattern that nothing reads and nothing keeps in step.

`clearAllData` removes the per-list `@patterns_*` keys as well as the two top-level ones. `collectOrphanedPatternKeys` reclaims `@patterns_*` entries whose list no longer exists and is called once, unawaited, from `ActivePatternListProvider` after the initial load — it must never delay or fail first paint.


## Schema versioning and migrations

Stored data carries a version under `@schemaVersion`, and `runMigrations()`
(`migrations/`) brings it up to `SCHEMA_VERSION` **before anything reads pattern
data** — it is awaited first in `ActivePatternListProvider`'s mount effect, behind the loading
state that was already there.

Rules for adding one: bump `SCHEMA_VERSION`, add the migration to `MIGRATIONS`, and make it
**idempotent** — a crash part-way through leaves the version marker unchanged, so it runs again
next launch. Migrations never run backwards: if the stored version is *ahead* of the build (the
user installed an older APK over a newer one), nothing runs and the marker is left alone, because
downgrading the data would discard whatever the newer build added. A failed migration is logged
and does not block startup; the read-time repairs still cope.

The read-time normalisation in `PatternListStorage` stays even though migration 001 materialises
it — data still arrives from imports and cloud syncs after migrations have run.

## Import validation

**Never trust an import file.** It comes from a document picker, so it comes from anywhere, and
everything downstream writes it to storage and then to the screen.
`validateExportData` (`validation/`) is the only gate, and `ImportPatterns` calls
it before touching anything. It splits problems in two:

- **Fatal** — not an object, an unsupported version, `patternLists` not an array, a list with no
  id, a pattern whose id is not an integer, duplicate ids. The whole file is refused, because a
  half-import leaves the user unable to tell what landed.
- **Repairable** — a pattern pointing at a type that is not in its list, a prerequisite matching
  no pattern, a malformed video reference. Cleaned, reported through the existing `warnings`
  channel, and the import proceeds.

What it returns is normalised: optional fields filled in, references resolvable. Nothing
downstream re-checks it.

`canImport` (`types/ExportVersion.ts`) owns compatibility, separate from `exportDataVersion` which
is what we *write*. A newer **minor** is refused rather than parsed best-effort: the writer added
a field this build cannot carry, and saving over it would silently drop the user's data. Bumping
the format means bumping `SUPPORTED_MINOR` here too.

## Import conflict resolution

`useImportDecisions` derives each list's default from its props on every read — `skip` when the id
already exists locally, `replace` when it does not — and keeps only the user's explicit choices in
state. It must stay that way. The defaults used to be snapshotted by a lazy `useState`
initialiser, which never saw real data: `SettingsScreen` mounts `PatternListImportModal`
permanently and only toggles `visible`, so the hook first ran with an empty list and the real one
arrived as a prop change. Every conflicting list then fell through to `replace` and was silently
overwritten.

The same shape applies to any hook behind one of these always-mounted modals: derive from props,
or remount so the snapshot is retaken. `PatternListTemplateModal` takes the second route — it keys
its body on what the modal is open on, so opening it re-mounts with drafts seeded fresh — and that
is equally correct. What is not correct is snapshotting once and leaving it.

## Export / Import format

Version `"3.0.0"` JSON — `exportDataVersion` and `IPatternListExportData` in `types/IExportData.ts`:

```ts
{ version, exportDate, includesVideos, patternLists: PatternListWithPatterns[], videos: { [localPath]: base64 } }
```

- `exportPatternLists(lists, includeVideos, exportAsReadonly)` (`exportPatterns.ts`) writes the file to the document directory and hands it to `expo-sharing`. With `includeVideos === false` local refs are stripped instead of embedded (URL refs always survive); with `exportAsReadonly` each list gets `readonly: true`.
- Videos are keyed in the `videos` map by their **original local path**; pattern videos, universal-modifier videos and per-pattern modifier-combination videos are all embedded.
- `importPatternLists()` (`ImportPatterns.ts`) picks a file via `expo-document-picker`, decodes base64 videos back to the local filesystem via `expo-file-system`, and returns the lists — collecting non-fatal `warnings` for missing/unreadable videos.

Export/import UI lives in `components/` (`PatternListExportModal`, `PatternListImportModal`, and helpers `ConflictBadge`, `ExportListItem`, `ImportListItem`, `ImportSummary`, `SelectAllButton`, `ImportActionButtons`). The backing hooks are `useExportSelection` and `useImportDecisions` (`ImportAction = "skip" | "replace"` per list, defaulting to `skip` on id conflict) in `hooks/`; `src/settings/hooks/useDataTransfer.ts` orchestrates the full flow from `SettingsScreen`.


## Default list templates

`DefaultPatternLists.ts` exposes factory functions (`createWestCoastSwingList`, `createSalsaList`, `createBachataList`, `createTangoList`, `createLindyHopList`, `createBlankList`) built on `createPatternList` / `createPatternType`. Each returns a fresh `IPatternList` with UUID-stamped `PatternType`s and an empty `modifiers` array. `TEMPLATE_FOUNDATIONAL_PATTERNS` maps a template id (`wcs`, `salsa`, …) to starter `TemplatePattern[]`; `resolveTemplatePatterns` converts those to `NewPattern[]` by matching `typeSlug` → `typeId`, so templates stay stable across renames. Picking a template happens in `PatternListTemplateModal`.

