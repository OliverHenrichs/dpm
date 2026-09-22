# AGENTS.md — DancePatternMapper

Expo/React Native (TypeScript) app for mapping partner-dance prerequisite graphs.

This file is the orientation layer: architecture, the shared data model, and the rules that
apply wherever you are working. Depth lives next to the code it governs, in a nested
`AGENTS.md` that loads when you open a file in that directory:

| File | Covers |
|---|---|
| `src/common/AGENTS.md` | Theming, `AppHeader`, the Android edge band, dismissal touches, the web split |
| `src/pattern/data/AGENTS.md` | Storage, pattern ids, migrations, import validation, export format |
| `src/pattern/graph/AGENTS.md` | Graph model, layouts, gestures, node drag, badges, prerequisite integrity |
| `src/pattern/list/AGENTS.md` | `usePatternCrud`, modifiers, sorting, always-mounted modals |
| `src/settings/AGENTS.md` | i18n machinery, device locale, language persistence |
| `src/firebase/AGENTS.md` | Firestore sharing and its configuration |
| `__tests__/AGENTS.md` | Jest projects, the global mocks, and the traps in this suite |

Creating a *new* file in a directory does not pull its `AGENTS.md` in — read or search something
there first.

## Architecture overview

```
app/_layout.tsx        ← root layout (imports @/src/i18n)
  ThemeProvider        ← global light/dark theme
    ActivePatternListProvider  ← global state: active list + its patterns
      Drawer           ← expo-router/drawer, 4 file-based routes
```

Navigation is **file-based expo-router**; there is no `@react-navigation/*` dependency (SDK 56 forbids importing those from app code — Metro fails the bundle). Import `Drawer` from `expo-router/drawer`, and `useNavigation` / `useFocusEffect` / `router` / `usePathname` from `expo-router`. Screens navigate with `router.navigate("/patterns")`, not a `navigation` prop.

| File | Path | Screen component |
|---|---|---|
| `app/index.tsx` | `/` | `src/pattern/list/PatternListSelector.tsx` |
| `app/patterns.tsx` | `/patterns` | `src/pattern/list/PatternListManager.tsx` |
| `app/graph.tsx` | `/graph` | `src/pattern/graph/PatternGraphScreen.tsx` |
| `app/settings.tsx` | `/settings` | `src/settings/SettingsScreen.tsx` |

Each route file is a one-line re-export; the screens live in `src/`. `src/common/components/DrawerRoutes.ts` is the single source of truth for the route list (name, href, i18n title key, whether the header shows the active list's name) and is consumed by the navigator, the drawer menu (`DrawerContent.tsx`) and `AppHeader.tsx` — add a route there and in `app/`, not in three places.

All screens share state through `ActivePatternListContext` (`src/pattern/data/components/ActivePatternListContext.tsx`). Every screen reads `activeList`, `patterns`, `isLoading`, and `hasLists` from `useActivePatternList()` and mutates via `setActiveList`, `updatePatterns`, `updateActiveList(list, patternsOverride?)`, `refreshActiveList` — **never loads storage directly**. Pattern and modifier mutations go through `usePatternCrud`, never through the context directly.

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

Modifiers are affixes ("with a spin", "slow") that live on the list, not on a pattern. **Universal** ones implicitly apply to every pattern and carry their own `videoRefs`; **non-universal** ones are attached per-pattern through `IPattern.modifierRefs`, each attachment carrying its own videos of that combination.

**Pattern ids are never reused.** `IPatternList.nextPatternId` is a high-water mark; `nextPatternId(list, patterns)` in `src/pattern/data/patternIds.ts` is the only way to mint one. The manual graph layout outlives individual patterns, so a reused id would inherit a stranger's stored position.

## Rules that apply everywhere

- **Path alias.** `@/` resolves to the **project root** (not `src/`). Use `@/src/...` for source imports and `@/utils/...` for test utilities. The same mapping is configured in `tsconfig.json` and in `jest.config.js` (`moduleNameMapper`).
- **Read-only lists.** `IPatternList.readonly` is set on imported read-only exports and on subscribed cloud lists. Every mutating path must guard on it (`const isReadonly = !!activeList?.readonly`). The one deliberate exception is dragging a graph node, which is a local view preference.
- **Translations.** All user-facing strings use `const { t } = useTranslation()`. The app ships **nine** locales — `en`, `zh`, `hi`, `es`, `fr`, `ar`, `bn`, `pt`, `de` — and a key must be added to **every** `locales/*.json` (flat key/value, no nesting), with `en` written first as the source of truth. `__tests__/unit/i18n.test.ts` fails on a key missing from any locale, an empty value, a mismatched `{{placeholder}}` set, or a `t("…")` call with no key behind it.
- **Theming.** `const { colorScheme } = useThemeContext()` → `getPalette(colorScheme)` → `palette[PaletteColor.Background]`. Styles are built inline per render; reuse the fragments in `src/common/utils/CommonStyles.ts`.
- **Screen edges.** `SCREEN_EDGE_INSET` is applied once as `PageContainer`'s horizontal padding, to stay clear of the Android system back-gesture band. Do not pad individual scrollers.
- **Platform splits.** Metro resolves `Foo.web.tsx` in preference to `Foo.tsx` when bundling for web, and the two files must export the same shape. The two that exist are `YouTubeVideoItem` and `PatternNodeGroup`; route node presses through the latter rather than putting `onPress` on an SVG element directly. Verify both targets with `npx expo export --platform web` and `--platform android` — web also builds an SSR bundle, so a bad import surfaces twice.

## Filtering & sorting

`PatternFilter` (`src/pattern/filter/components/PatternFilterBottomSheet.tsx`): `{ name, types, levels, counts?, tags }`, applied by `usePatternFilter` (`src/pattern/filter/hooks/usePatternFilter.ts`) and shared by the list and graph screens. Sub-panels: `NameFilter`, `TypeFilter`, `LevelFilter`, `CountsFilter`, `TagFilter`. Sorting is in `src/pattern/list/`. Both panels render through the shared `BottomSheet` (`src/common/components/BottomSheet.tsx`).

**Never hand a filtered `patterns` array to a graph layout function** — see `src/pattern/graph/AGENTS.md`.

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

Tests live in `__tests__/`, split into a `unit` project and a `components` project; a test in the wrong directory is silently never run. See `__tests__/AGENTS.md`.

## Configuration

Config is **dynamic** — `app.config.ts` (there is no `app.json`) reads credentials from environment variables, so nothing secret is committed. Copy `.env.example` to `.env` (gitignored); the Firebase variables are listed in `src/firebase/AGENTS.md`. Without them the app runs local-only.

**Config plugins are applied only when listed in `app.config.ts` → `plugins`; autolinking does not apply them.** `expo-camera`, `expo-image-picker` and `expo-localization` are listed there for that reason — the first two purely so their iOS usage strings (`NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription`) reach the generated `Info.plist`, which iOS terminates the app without; Android's equivalent arrives via manifest merging regardless, so the omission is invisible until an iOS device runs it. Both pass `microphonePermission: false` (and camera `recordAudioAndroid: false`) because nothing in the app records audio — that also blocks `RECORD_AUDIO` from being merged in by a transitive dependency. `ios.bundleIdentifier` must stay in `app.config.ts` too: there is no `app.json`, so the CLI cannot write it, and without it `expo prebuild --platform ios` and EAS iOS builds both refuse to run.

Note that `expo prebuild` rewrites the `android` / `ios` npm scripts to `expo run:*` — revert that, the project uses the `--dev-client` workflow. Adding a native module means rebuilding the dev client; Metro will happily serve JS the installed client has no native side for.

## Dependencies

- Do **not** run `npx expo install --fix`. Several packages are deliberately ahead of the versions SDK 57 bundles — `@react-native-async-storage/async-storage@3`, `react-native-gesture-handler@3`, `jest@30`, `react@19.2.7`, `react-native-safe-area-context`, `react-native-svg` — and `--fix` would downgrade them, two across a major. `npx expo install --check` listing them is expected.
- `react-test-renderer` is pinned to the exact `react` version and must be bumped with it. `jest-expo` must track the SDK major.
- `npm audit` is expected to report **three moderate findings and nothing else** — all one root cause, `expo-router` → `query-string@7` → `decode-uri-component`, which cannot be forced past an ESM-only fix under a CJS parent and has to wait for expo-router upstream. Anything beyond that is new. `overrides` in `package.json` carries the rest; each entry exists because a parent pins a range below the fix.

## Continuous integration

`.github/workflows/ci.yml` runs on every push to `master` and every PR, in three jobs:

- **verify** — `npm run lint`, `npm run format:check`, `npm run typecheck`, `npx jest --coverage --ci`.
- **bundle** — `npx expo export` for **both** `web` and `android`, which is the gate that catches a platform-split import fault.
- **audit** — fails if `npm audit` drifts from the baseline of exactly three moderate findings. If a change to that baseline is intentional, update both the workflow's `expected` map and this file.

Run the same checks locally before pushing; every one of them passes on `master`.
