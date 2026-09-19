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

Patterns and lists are stored under **separate keys**. Always use the helpers in `PatternListStorage.ts` (`loadAllPatternLists`, `savePatternList`, `deletePatternList`, `getPatternListById`, `getActiveListId`, `setActiveListId`, `getActiveList`, `loadPatterns`, `savePatterns`, `hasPatternLists`, `clearAllData`) — never call `AsyncStorage` directly from UI code.

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

## Read-only lists

`IPatternList.readonly` is set on imported read-only exports and on subscribed cloud lists. Every mutating path must guard on it (`const isReadonly = !!activeList?.readonly`) — pattern and modifier CRUD in `PatternListManager` already does.

## Path alias

`@/` resolves to the **project root** (not `src/`). Use `@/src/...` for source imports and `@/utils/...` for test utilities. The same mapping is configured in `tsconfig.json` and in `jest.config.js` (`moduleNameMapper`).

## Platform-specific code

Metro resolves `Foo.web.tsx` in preference to `Foo.tsx` when bundling for web, and the two files must export the same shape.

- `src/common/components/YouTubeVideoItem.tsx` uses `react-native-youtube-iframe`, which renders through `react-native-webview`. That library has no web build (its web entry imports the unmaintained `react-native-web-webview`), so `YouTubeVideoItem.web.tsx` embeds the YouTube iframe directly instead. Keep the YouTube player behind this component — importing `react-native-youtube-iframe` anywhere reachable from web breaks the web bundle.
- Verify both targets with `npx expo export --platform web` and `--platform android`; web also builds an SSR bundle (static rendering is on), so a bad import surfaces twice.

## Dependencies & security

`npm audit` is expected to report **three moderate findings and nothing else**. Anything beyond that is new and worth looking at.

- The three expected ones are one root cause: `expo-router` → `query-string@7` → `decode-uri-component@0.2.2`. The patched `decode-uri-component@0.5.0` is ESM-only, so it cannot be forced under the CJS `query-string@7`; this has to wait for expo-router upstream. Impact is a DoS in query-string decoding, reachable only through a URL the user opens.
- `overrides` in `package.json` carries the rest. Each entry exists because a parent pins a range that sits below the fix — keep the comment-worthy ones in mind before removing any:
  `shell-quote` (react-devtools-core), `brace-expansion@1` / `@5` (eslint and @typescript-eslint minimatch), `@humanfs/node` (eslint), `@babel/core`, `flatted` (eslint flat-cache), and `xcode` → `uuid@^11` (xcode only calls `uuid.v4()`, unchanged across those majors; it runs during iOS prebuild).
- `react-test-renderer` is pinned to the exact `react` version and must be bumped with it.
- Do **not** run `npx expo install --fix`. Several packages are deliberately ahead of the versions SDK 57 bundles — `@react-native-async-storage/async-storage@3`, `react-native-gesture-handler@3`, `jest@30`, `react@19.2.7`, `react-native-safe-area-context`, `react-native-svg` — and `--fix` would downgrade them, two across a major. `npx expo install --check` listing them is expected.
- `react-native-web` 0.21 warns that `shadow*` and `textShadow*` style props are deprecated. `shadow*` is migrated to the `boxShadow` shorthand; `textShadow` is not, because react-native 0.86 still types only `textShadowColor` / `textShadowOffset` / `textShadowRadius` (see `QrCodeScanner.tsx`).

## Developer workflows

```bash
npm install              # install deps
npm start                # expo start --lan (or: npx expo start)
npm run android          # expo start --android
npm run ios              # expo start --ios
npm test                 # Jest (node env, no device needed)
npm run test:watch       # watch mode
npm run test:coverage    # coverage for src/pattern/data/** + src/pattern/graph/utils/**
npm run lint             # ESLint via expo lint
```

Stack: Expo SDK ~57 / React Native 0.86 / React 19 / TypeScript ~6, `newArchEnabled`, typed routes and the React Compiler are on (`app.config.ts` → `experiments`).

## Testing conventions

- All tests live in `__tests__/` (not co-located), named `*.test.ts(x)`. Test environment is `node`; transform is `ts-jest`.
- Coverage is scoped to `src/pattern/data/**` and `src/pattern/graph/utils/**`.
- Use factory helpers from `utils/testFactories.ts` (`createTestPattern`, `createTestPatternList`, `createTestPatternType`) — do not inline raw object literals in tests. They already supply `modifiers: []` / `modifierRefs: []`, so new required fields belong there too.
- `IPattern.id` in tests should be a plain integer; `PatternType.id` / `IPatternList.id` / `IModifier.id` should use `generateUUID()`.
