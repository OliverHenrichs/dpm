# AGENTS.md — DancePatternMapper

Expo/React Native (TypeScript) app for mapping partner-dance prerequisite graphs.

## Architecture overview

```
app/_layout.tsx        ← root layout (imports @/src/i18n)
  ThemeProvider        ← global light/dark theme
    ActivePatternListProvider  ← global state: active list + its patterns
      Drawer           ← expo-router/drawer, 4 file-based routes
```

Navigation is **file-based expo-router**; there is no `@react-navigation/*` dependency (SDK 56 forbids importing those from app code — Metro fails the bundle). Import `Drawer` from `expo-router/drawer`, and `useNavigation` / `useFocusEffect` / `router` / `usePathname` from `expo-router`.

| File | Path | Screen component |
|---|---|---|
| `app/index.tsx` | `/` | `src/pattern/list/PatternListSelector.tsx` |
| `app/patterns.tsx` | `/patterns` | `src/pattern/list/PatternListManager.tsx` |
| `app/graph.tsx` | `/graph` | `src/pattern/graph/PatternGraphScreen.tsx` |
| `app/settings.tsx` | `/settings` | `src/settings/SettingsScreen.tsx` |

Each route file is a one-line re-export; the screens live in `src/`. `src/common/components/DrawerRoutes.ts` is the single source of truth for the route list (name, href, i18n title key, whether the header shows the active list's name) and is consumed by the navigator, the drawer menu (`DrawerContent.tsx`) and `AppHeader.tsx` — add a route there and in `app/`, not in three places.

Screens navigate with `router.navigate("/patterns")`, not a `navigation` prop. In `AppHeader` the app icon is a home button that navigates to `HOME_ROUTE` (also exported from `DrawerRoutes.ts` — the first drawer entry, `/`), and the hamburger opens the drawer via `useNavigation<{ openDrawer: () => void }>()`; `DrawerContent` must take `navigation` from the `drawerContent` render prop instead, since it sits beside the screens and `useNavigation()` there does not resolve to the drawer navigator.

Pattern and modifier **mutations** go through `usePatternCrud` (`src/pattern/list/hooks/usePatternCrud.ts`), not through the context directly. It owns the read-only guard, id allocation, the prerequisite scrub on delete and the opportunistic Firestore push, and every mutation returns whether it was applied so a caller can keep a form open on rejection. `PatternListManager` is left holding only which modal is open. Add a mutation there, not inline in a screen.

All screens share state through `ActivePatternListContext` (`src/pattern/data/components/ActivePatternListContext.tsx`). Every screen reads `activeList`, `patterns`, `isLoading`, and `hasLists` from `useActivePatternList()` and mutates via `setActiveList`, `updatePatterns`, `updateActiveList(list, patternsOverride?)`, `refreshActiveList` — never loads storage directly. The provider also maintains a live Firestore subscription via `useSharedList` when the active list has a `shareCode`.

## Core data model

Everything lives in `src/pattern/types/IPatternList.ts` (plus `PatternType.ts`, `PatternLevel.ts`).

| Type | Id type | Key detail |
|---|---|---|
| `IPatternList` | `string` (UUID) | Owns its own `PatternType[]` **and** `IModifier[]` — both are **per-list**, not global; optional `readonly?: boolean` (subscriber/read-only copy) and `shareCode?: string` (Firestore doc ID) |
| `PatternType` | `string` (UUID) | `slug` = display name; `color` = hex; referenced from patterns via `typeId` |
| `IPattern` | `number` (integer) | `prerequisites: number[]` drives both graph views; `typeId` is a UUID string; `tags: string[]`; optional `level` (`PatternLevel` value); `videoRefs: IVideoReference[]`; `modifierRefs: IPatternModifierRef[]` |
| `IModifier` | `string` (UUID) | `position: "prefix" \| "postfix" \| "amends"`; `universal: boolean`; `videoRefs` are only used when `universal === true` |
| `IPatternModifierRef` | — | `{ modifierId, videoRefs }` — a non-universal modifier attached to one pattern, with videos of that pattern **executed with** the modifier |
| `IVideoReference` | — | `{ type: "url" \| "local", value: string, startTime?: number }` (`startTime` for URL videos only) |

Creation helper types: `NewPattern = Omit<IPattern, "id">`, `NewModifier = Omit<IModifier, "id">`.

`PatternType.ts` also exports `PATTERN_TYPE_COLORS` (12 named hex colours), `generateUUID()`, `normalizeSlug()`, and `isSlugUnique()`.

## Modifiers

Modifiers are affixes ("with a spin", "slow") that live on the list, not on a pattern:

- **Universal** modifiers implicitly apply to every pattern in the list and carry their own `videoRefs`.
- **Non-universal** modifiers are attached per-pattern through `IPattern.modifierRefs`; each attachment carries its own videos of that specific combination.

`PatternListManager` has a `patterns` / `modifiers` tab switch and owns modifier CRUD (`addModifier`, `editModifier`, `deleteModifier` — deleting also scrubs the id from every pattern's `modifierRefs`). UI: `ModifierList` → `ModifierListItem` → `ModifierDetails`, editing via `EditModifierForm`; `ModifierPillStrip` renders/toggles a pattern's modifiers inside `EditPatternForm` and `PatternDetails`.

## Persistence (AsyncStorage)

Storage keys in `src/pattern/data/PatternListStorage.ts`:
- `@patternLists` — serialised `IPatternList[]` (no patterns)
- `@patterns_{listId}` — serialised `IPattern[]` for a given list
- `@activeListId` — UUID of the currently active list

Patterns and lists are stored under **separate keys**. Always use the helpers in `PatternListStorage.ts` (`loadAllPatternLists`, `savePatternList`, `deletePatternList`, `getPatternListById`, `getActiveListId`, `setActiveListId`, `getActiveList`, `loadPatterns`, `savePatterns`, `hasPatternLists`, `clearAllData`, `collectOrphanedPatternKeys`) — never call `AsyncStorage` directly from UI code.

**`@patternLists` holds lists without patterns.** The import and cloud-subscribe paths both hand over a `PatternListWithPatterns`, whose extra `patterns` array TypeScript cannot see because `IPatternList` has no such field — so `savePatternList` strips it rather than trusting callers, and `loadAllPatternLists` strips it again to clean up records an older build already bloated. Do not "simplify" that away: it writes a second copy of every pattern that nothing reads and nothing keeps in step.

`clearAllData` removes the per-list `@patterns_*` keys as well as the two top-level ones. `collectOrphanedPatternKeys` reclaims `@patterns_*` entries whose list no longer exists and is called once, unawaited, from `ActivePatternListProvider` after the initial load — it must never delay or fail first paint.

## Header layout

`AppHeader` lays its three children out in flow — a fixed-width button slot, the title at `flex: 1`,
another slot of the same width. Because both sides are equal the title lands on the centre of the
screen without being positioned over anything.

**Do not make the title absolute again.** It used to be `position: "absolute"` across the full
header width, relying on `pointerEvents: "none"` to stay out of the way — but that is a View style
prop and React Native's `Text` does not implement it, so the title sat on top of the home button
and swallowed most presses. A component test cannot catch that (RNTL has no layout engine and
cannot tell that one view covers another), so the guard in
`__tests__/components/AppHeader.test.tsx` pins the structure instead, and the real check is tapping
the icon on a device.

## Prerequisite integrity

`IPattern.prerequisites` is the data model — both graph views are built from it — and two ways of
corrupting it used to make patterns disappear from the network view while the list and timeline
still showed them. Three rules keep that shut, and all three live in
`src/pattern/graph/utils/GenericGraphUtils.ts`:

- **Never remove a pattern without scrubbing references to it.** `deletePattern` composes deletion
  as `repairDanglingPrerequisites(patterns.filter(...))` rather than filtering alone. The helper
  returns the same array reference when there is nothing to repair, so the healthy path is free.
- **`loadPatterns` repairs on read**, so lists corrupted by older builds heal themselves as they
  load. Do not remove this in favour of a one-off migration — there is no migration runner yet
  ([F3](AGENT_TASKS.md)).
- **The prerequisite picker refuses cycles.** `findIneligiblePrerequisiteIds(patterns, id)` returns
  the pattern plus everything that already depends on it; `EditPatternForm` disables those chips.
  Note the direction: `P.prerequisites = [Q]` means Q comes *before* P, so the edge runs Q → P and
  "would cycle" means Q already depends on P. Use `collectDependentIds` to walk forwards; it is a
  BFS over an index, not the path-enumerating `detectCircularDependencies` beside it.

Belt and braces, and the part that actually protects the user: **`calculateGraphLayout` must place
every node it is given.** Its DFS only places a node once all prerequisites are positioned, so a
dangling id or a cycle leaves one unplaceable — and `drawNodes` renders nothing for a node with no
position, losing it and its whole subtree silently. A fallback pass positions whatever is left
over from its known prerequisites, or on a ring outside the foundational ellipse. Keep that pass,
and keep `__tests__/unit/GraphLayoutInvariants.test.ts` asserting
`positions.size === patterns.length` for degenerate input: imports, shared lists and old devices
still supply both kinds of bad data.

## Theming

Every component that needs colours does:
```tsx
const { colorScheme } = useThemeContext();       // "light" | "dark"
const palette = getPalette(colorScheme);          // → LightPalette or DarkPalette
// then: palette[PaletteColor.Background], etc.
```
Styles are created inline per-render (no shared static stylesheets). `PaletteColor` enum and both palettes live in `src/common/utils/ColorPalette.ts`. Recurring style fragments are factored into `src/common/utils/CommonStyles.ts` (`getCommonButton`, `getCommonInput`, `getCommonLabel`, …) and `src/pattern/filter/FilterCommonStyles.ts` (chips, filter sections) — reuse those instead of re-declaring them.

## Internationalisation

All user-facing strings use `const { t } = useTranslation()`. Translation keys must be added to **both** `locales/en.json` and `locales/de.json` (flat key/value, no nesting). i18n is initialised once in `src/i18n.ts` (imported by `app/_layout.tsx`; it lives outside `app/` because every file in there becomes a route); available languages are listed in `src/settings/types/Languages.ts`.

## Graph views

`src/pattern/graph/` contains two switchable views (`ViewMode = "timeline" | "graph"`, selected in `PatternGraphScreen`, rendered by `GraphViewContainer` alongside `Legend`) driven by `IPattern.prerequisites[]`:
- **Timeline** (`TimelineView.tsx`) — swimlane by `PatternType`, left-to-right by depth (`calculateDynamicTimelineLayout` in `TimelineGraphUtils.ts`); skip-level edge routing handled by `CollisionAvoidanceUtils.ts`
- **Network** (`NetworkGraphView.tsx`) — force-free hierarchical layout (`calculateGraphLayout` in `NetworkGraphUtils.ts`); layout logic extracted into the `useGraphLayout` hook (`src/pattern/graph/hooks/useGraphLayout.ts`)

Shared graph utilities: `GenericGraphUtils.ts` (`generateEdges`, `detectCircularDependencies`, `calculatePrerequisiteDepthMap` — generic over `PatternLike`), `GraphUtils.ts` (`LayoutPosition`, edge generation, `generateOrthogonalPath` / `generateSkipLevelPath`). Layout constants (`NODE_HEIGHT`, `HORIZONTAL_SPACING`, …) are centralised in `src/pattern/graph/types/Constants.ts`; the shared SVG props contract is `IGraphSvgProps` in `src/pattern/graph/types/IGraphSvgProps.ts` (rendered by `GraphSvg.tsx` / `PatternNode.tsx`). Tapping a node opens `PatternDetailsModal` → `PatternDetails`.

## Filtering & sorting

- `PatternFilter` (`src/pattern/filter/components/PatternFilterBottomSheet.tsx`): `{ name, types, levels, counts?, tags }`, applied by `usePatternFilter` (`src/pattern/list/hooks/usePatternFilter.ts`). Sub-panels: `NameFilter`, `TypeFilter`, `LevelFilter`, `CountsFilter`, `TagFilter`.
- `SortConfig` (`src/pattern/list/SortBottomSheet.tsx`): `{ field, order }` with `SortField = "name" | "typeId" | "level" | "counts" | "id"` and `SortOrder = "asc" | "desc"`, applied by `usePatternSort`.

Both panels are rendered through the shared `BottomSheet` component (`src/common/components/BottomSheet.tsx`).

## Default list templates

`src/pattern/data/DefaultPatternLists.ts` exposes factory functions (`createWestCoastSwingList`, `createSalsaList`, `createBachataList`, `createTangoList`, `createLindyHopList`, `createBlankList`) built on `createPatternList` / `createPatternType`. Each returns a fresh `IPatternList` with UUID-stamped `PatternType`s and an empty `modifiers` array. `TEMPLATE_FOUNDATIONAL_PATTERNS` maps a template id (`wcs`, `salsa`, …) to starter `TemplatePattern[]`; `resolveTemplatePatterns` converts those to `NewPattern[]` by matching `typeSlug` → `typeId`, so templates stay stable across renames. Picking a template happens in `PatternListTemplateModal`.

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

Version `"3.0.0"` JSON — `exportDataVersion` and `IPatternListExportData` in `src/pattern/data/types/IExportData.ts`:

```ts
{ version, exportDate, includesVideos, patternLists: PatternListWithPatterns[], videos: { [localPath]: base64 } }
```

- `exportPatternLists(lists, includeVideos, exportAsReadonly)` (`exportPatterns.ts`) writes the file to the document directory and hands it to `expo-sharing`. With `includeVideos === false` local refs are stripped instead of embedded (URL refs always survive); with `exportAsReadonly` each list gets `readonly: true`.
- Videos are keyed in the `videos` map by their **original local path**; pattern videos, universal-modifier videos and per-pattern modifier-combination videos are all embedded.
- `importPatternLists()` (`ImportPatterns.ts`) picks a file via `expo-document-picker`, decodes base64 videos back to the local filesystem via `expo-file-system`, and returns the lists — collecting non-fatal `warnings` for missing/unreadable videos.

Export/import UI lives in `src/pattern/data/components/` (`PatternListExportModal`, `PatternListImportModal`, and helpers `ConflictBadge`, `ExportListItem`, `ImportListItem`, `ImportSummary`, `SelectAllButton`, `ImportActionButtons`). The backing hooks are `useExportSelection` and `useImportDecisions` (`ImportAction = "skip" | "replace"` per list, defaulting to `skip` on id conflict) in `src/pattern/data/hooks/`; `src/settings/hooks/useDataTransfer.ts` orchestrates the full flow from `SettingsScreen`.

## Firebase / cloud sharing

`src/firebase/` provides optional Firestore-backed list sharing:
- `firebaseConfig.ts` — reads credentials from `Constants.expoConfig.extra.firebase`; when absent, `firebaseAvailable === false` and all service calls throw/no-op rather than crash the app. Also exports `db`, `APP_TOKEN` (write guard checked by Firestore Security Rules) and `SHARED_LISTS_COLLECTION = "sharedLists"`.
- `FirebaseListService.ts` — `publishList`, `syncPublishedList`, `unpublishList`, `fetchSharedList`, `subscribeToSharedList`; documents follow `SharedListDocument` (`list`, `patterns`, `publisherVersion`, `publishedAt`, `appToken`). Share codes are 8-char alphanumeric, generated with `expo-crypto` (CSPRNG).
- `useSharedList` (`src/pattern/data/hooks/useSharedList.ts`) — called inside `ActivePatternListProvider`; maintains a live `onSnapshot` listener while `activeList.shareCode` is set; handles publisher unpublishing (clears `shareCode`/`readonly` locally and surfaces a themed dialog).

**Publisher flow**: `ShareListModal` → `publishList()` → `IPatternList.shareCode` set → stored locally; the modal can render the code as a QR code (`react-native-qrcode-svg`).
**Subscriber flow**: `SubscribeListModal` → type the 8-char code or scan the QR with `QrCodeScanner` (`expo-camera`) → `fetchSharedList()` → list saved with `readonly: true` and `shareCode` → `useSharedList` keeps it in sync.

Writes are also pushed opportunistically from the UI: `PatternListManager` calls `syncPublishedList(activeList, patterns)` after pattern CRUD when a `shareCode` exists.

### Configuration

Config is **dynamic** — `app.config.ts` (there is no `app.json`) reads credentials from environment variables, so nothing secret is committed. Copy `.env.example` to `.env` (gitignored) and fill in:

```
FIREBASE_API_KEY, FIREBASE_AUTH_DOMAIN, FIREBASE_PROJECT_ID, FIREBASE_STORAGE_BUCKET,
FIREBASE_MESSAGING_SENDER_ID, FIREBASE_APP_ID, FIREBASE_MEASUREMENT_ID, FIREBASE_APP_TOKEN
```

Expo loads `.env` automatically for `expo start` / `eas build`; for EAS builds the same names must exist as EAS Secrets. Without them the app runs local-only.

### Config plugins

**Config plugins are applied only when listed in `app.config.ts` → `plugins`; autolinking does not apply them.** `expo-camera` and `expo-image-picker` are listed there purely so their iOS usage strings (`NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription`) reach the generated `Info.plist` — iOS terminates an app that touches those APIs without them, and Android's permission arrives via manifest merging regardless, so the omission is invisible until an iOS device runs it. Both pass `microphonePermission: false` (and camera `recordAudioAndroid: false`) because nothing in the app records audio; that also blocks `RECORD_AUDIO` from being merged in by a transitive dependency.

`expo-document-picker` is deliberately **not** listed: its plugin only sets iCloud entitlements, and only when `ios.usesIcloudStorage` is set, which this app does not use.

`ios.bundleIdentifier` must stay in `app.config.ts`. There is no `app.json`, so the CLI cannot write it for you — without it `expo prebuild --platform ios` and EAS iOS builds both refuse to run.

Verify a change here by running `npx expo prebuild --platform ios --no-install --clean` and grepping the generated `ios/*/Info.plist`; `npx expo config --type prebuild` will *not* show these, because the plugins apply through mods that only run during prebuild. Prebuild also rewrites the `android` / `ios` npm scripts to `expo run:*` — revert that, the project uses the `--dev-client` workflow.

## Read-only lists

`IPatternList.readonly` is set on imported read-only exports and on subscribed cloud lists. Every mutating path must guard on it (`const isReadonly = !!activeList?.readonly`) — pattern and modifier CRUD in `PatternListManager` already does.

## Path alias

`@/` resolves to the **project root** (not `src/`). Use `@/src/...` for source imports and `@/utils/...` for test utilities. The same mapping is configured in `tsconfig.json` and in `jest.config.js` (`moduleNameMapper`).

## Platform-specific code

Metro resolves `Foo.web.tsx` in preference to `Foo.tsx` when bundling for web, and the two files must export the same shape.

- `src/common/components/YouTubeVideoItem.tsx` uses `react-native-youtube-iframe`, which renders through `react-native-webview`. That library has no web build (its web entry imports the unmaintained `react-native-web-webview`), so `YouTubeVideoItem.web.tsx` embeds the YouTube iframe directly instead. Keep the YouTube player behind this component — importing `react-native-youtube-iframe` anywhere reachable from web breaks the web bundle.
- `src/pattern/graph/PatternNodeGroup.tsx` is the tappable `<G>` around a graph node. On native it just sets `onPress`; on web that would make react-native-svg spread six react-native responder handlers onto the DOM node, one React console error each, per node — so `PatternNodeGroup.web.tsx` takes the DOM node through `forwardedRef` and binds the listener itself. Route node presses through this component rather than putting `onPress` on an SVG element directly.
- Verify both targets with `npx expo export --platform web` and `--platform android`; web also builds an SSR bundle (static rendering is on), so a bad import surfaces twice. Console errors like these only appear with a populated graph, so check a list that actually has patterns.

## Dependencies & security

`npm audit` is expected to report **three moderate findings and nothing else**. Anything beyond that is new and worth looking at.

- The three expected ones are one root cause: `expo-router` → `query-string@7` → `decode-uri-component@0.2.2`. The patched `decode-uri-component@0.5.0` is ESM-only, so it cannot be forced under the CJS `query-string@7`; this has to wait for expo-router upstream. Impact is a DoS in query-string decoding, reachable only through a URL the user opens.
- `overrides` in `package.json` carries the rest. Each entry exists because a parent pins a range that sits below the fix — keep the comment-worthy ones in mind before removing any:
  `shell-quote` (react-devtools-core), `brace-expansion@1` / `@5` (eslint and @typescript-eslint minimatch), `@humanfs/node` (eslint), `@babel/core`, `flatted` (eslint flat-cache), and `xcode` → `uuid@^11` (xcode only calls `uuid.v4()`, unchanged across those majors; it runs during iOS prebuild).
- `react-test-renderer` is pinned to the exact `react` version and must be bumped with it. `jest-expo` must track the SDK major.
- Do **not** run `npx expo install --fix`. Several packages are deliberately ahead of the versions SDK 57 bundles — `@react-native-async-storage/async-storage@3`, `react-native-gesture-handler@3`, `jest@30`, `react@19.2.7`, `react-native-safe-area-context`, `react-native-svg` — and `--fix` would downgrade them, two across a major. `npx expo install --check` listing them is expected.
- `react-native-web` 0.21 warns that `shadow*` and `textShadow*` style props are deprecated. `shadow*` is migrated to the `boxShadow` shorthand; `textShadow` is not, because react-native 0.86 still types only `textShadowColor` / `textShadowOffset` / `textShadowRadius` (see `QrCodeScanner.tsx`).

## Developer workflows

```bash
npm install              # install deps
npm start                # expo start --lan (or: npx expo start)
npm run android          # expo start --android
npm run ios              # expo start --ios
npm test                 # Jest, both projects (no device needed)
npm run test:unit        # pure-logic project only — sub-second feedback loop
npm run test:components  # rendering project only (jest-expo)
npm run test:watch       # watch mode
npm run test:coverage    # coverage over all of src/, with thresholds enforced
npm run lint             # ESLint via expo lint
npm run format:check     # Prettier, same glob CI uses
npm run format           # Prettier, write
npm run typecheck        # tsc --noEmit
```

Stack: Expo SDK ~57 / React Native 0.86 / React 19 / TypeScript ~6, `newArchEnabled`, typed routes and the React Compiler are on (`app.config.ts` → `experiments`).

## Testing conventions

All tests live in `__tests__/` (not co-located), named `*.test.ts(x)`. Jest runs **two projects** (`jest.config.js`), and a test must go in the directory matching its project:

| Project | Directory | Environment | Use it for |
|---|---|---|---|
| `unit` | `__tests__/unit/` | `node` + `ts-jest` | Pure logic — storage, graph maths, hooks-free helpers. Fast; this is where most tests belong. |
| `components` | `__tests__/components/` | `jest-expo` preset | Anything that renders. |

`npm test` runs both; `npm run test:unit` / `npm run test:components` run one. A test placed in the wrong directory is silently never run.

- **AsyncStorage is mocked globally and behaviourally.** `__mocks__/@react-native-async-storage/async-storage.ts` is a real in-memory store implementing the v3 surface, applied automatically (a `__mocks__` directory beside `node_modules` needs no `jest.mock()` call). Both setup files reset it per test. Assert on observable state (`await loadPatterns(id)`) rather than on mock bookkeeping (`setItem.mock.calls[0][1]`), so tests survive refactors of the storage internals. `seedAsyncStorage` / `peekAsyncStorage` are there for setup and assertions.
- **The filesystem is mocked globally too.** `__mocks__/expo-file-system.ts` is an in-memory `File` / `Paths` implementation that stores real bytes and does real base64, so no test can touch the real disk and an export→import round trip has to preserve bytes exactly. `seedFile` / `seedBinaryFile` set fixtures up, `readFileBytes` / `readFileText` / `listFileUris` assert on the result. It implements only the surface the app uses and throws on anything else, so a new call site surfaces here rather than silently no-oping.
- **Export and import are tested as a round trip**, not separately (`__tests__/unit/ExportImportRoundTrip.test.ts`): the two modules only agree through the on-disk format, so exercising them apart proves very little. Add a case there when changing either side or the format version.
- **Component tests render through `renderWithProviders`** (`utils/renderWithProviders.tsx`), which supplies the real provider stack — i18n, `ThemeProvider`, `ActivePatternListProvider` — and seeds storage before mounting. It re-exports everything from `@testing-library/react-native`, so import `screen`, `fireEvent`, `within` from it rather than from the library directly.
- **Native modules are mocked in `jest.setup.components.ts`** (expo-video, expo-camera, the pickers, haptics, sharing, the YouTube player, QR codes). The firebase SDK is mocked there too: it ships untranspiled ESM that jest cannot parse, and mocking matches how the app behaves without credentials (`firebaseAvailable === false`). Tests that need sharing should mock `@/src/firebase/FirebaseListService` directly.
- Use factory helpers from `utils/testFactories.ts` (`createTestPattern`, `createTestPatternList`, `createTestPatternType`) — do not inline raw object literals in tests. They already supply `modifiers: []` / `modifierRefs: []`, so new required fields belong there too.
- `IPattern.id` in tests should be a plain integer; `PatternType.id` / `IPatternList.id` / `IModifier.id` should use `generateUUID()`.
- **`tsconfig.jest.json` must not override `jsx`.** Expo's base sets `react-jsx` (the automatic runtime), and several components rely on it by importing only `FC`/`ReactNode` rather than `React`. An override to the classic `"react"` transform makes those files fail to compile under ts-jest with `TS2686: 'React' refers to a UMD global` — which surfaces only as `Failed to collect coverage from …` on stderr, does **not** fail the run, and quietly drops those files from the coverage report.
- **Timeouts are sized for a cold CI runner, not for a warm laptop.** `npm ci` wipes the Babel cache, so the first component test in a run transforms the whole React Native + Expo tree before it can render: a test that takes ~300ms warm takes ~3.5s with caches cleared, and more on a slower runner. Hence `testTimeout` of 60s for components, 30s for unit, and `asyncUtilTimeout` of 10s for RNTL's `waitFor` (whose 1s default would fail as a confusing assertion error instead of a timeout). Reproduce the cold path with `npx jest --clearCache && rm -rf node_modules/.cache` before assuming a CI-only failure is a fluke.
- **Coverage thresholds are a ratchet**, set just under measured reality so CI is green on arrival (`jest.config.js` → `coverageThreshold`). Raise them as suites land; never lower them. Three mechanics to know before touching them. A file with its own entry is **removed from the `global` pool**, so pinning well-covered files pushes the global number *down* — it measures the leftovers, not the project. A file imported by both projects is instrumented by two transforms, so its percentages drift between run modes; set a floor under the lowest of `npx jest --coverage`, `--ci --maxWorkers=2` and `--maxWorkers=1`. And the **global figure itself varies by several points between otherwise identical runs**, because that merge depends on which worker saw a shared file first — so measure it a few times and floor it under the worst, never under the best. The numbers jest prints when a threshold is *missed* are the ones to key off, not the summary table's — they use different denominators.
- **Both projects set `clearMocks: true`**, which resets call history *and* factory implementations before each test. A mock whose return value matters must (re)establish it in `beforeEach`, not only in the `jest.mock` factory — otherwise it returns `undefined` and code that calls `.catch()` on it fails in a way React reports as `window.dispatchEvent is not a function`.
- **`renderHookWithProviders`** (`utils/renderWithProviders.tsx`) mounts a hook in the same provider stack. Wait for `activeList` to be non-null before acting: the provider loads storage on mount, and an assertion like "zero patterns" is already true on the first render, before anything has loaded.
- **Mocking `FirebaseListService` means mocking `subscribeToSharedList` too**, not just `syncPublishedList` — a list with a `shareCode` activates the provider's live-subscription hook.
- **`firebaseAvailable` is `false` under jest**, always: it derives from `Constants.expoConfig.extra.firebase`, which jest-expo does not populate. That is at least consistent between a dev machine (which has a `.env`) and CI (which does not), but it means the sharing screens render their "not configured" branch by default. A suite that tests the *available* path mocks `@/src/firebase/firebaseConfig` with a getter it can flip, rather than depending on the environment — see `ShareListModal.test.tsx`.
- **`test.failing` marks a known defect**, passing while the bug exists and failing the moment it is fixed. `__tests__/unit/GraphLayoutInvariants.test.ts` uses it to pin the dangling-prerequisite and cycle defects (AGENT_TASKS.md B1/B2). Prefer it over deleting or skipping a test that documents real broken behaviour.

## Continuous integration

`.github/workflows/ci.yml` runs on every push to `master` and every PR, in three jobs:

- **verify** — `npm run lint`, `npm run format:check`, `npm run typecheck`, `npx jest --coverage --ci`.
- **bundle** — `npx expo export` for **both** `web` and `android`. Metro resolves `.web.tsx` over `.tsx`, so a bad import can break exactly one platform; web additionally builds an SSR bundle (static rendering is on) and surfaces such a fault twice. This is the gate that catches the class of problem described under "Platform-specific code".
- **audit** — fails if `npm audit` drifts from the documented baseline of exactly three moderate findings (see "Dependencies & security"). If a change to that baseline is intentional, update both the workflow's `expected` map and this file.

Run the same checks locally before pushing; every one of them passes on `master`.
