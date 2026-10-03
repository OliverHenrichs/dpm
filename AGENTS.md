# AGENTS.md — DancePatternMapper

Expo/React Native (TypeScript) app for mapping partner-dance prerequisite graphs.

This file is the orientation layer: architecture, the shared data model, and the rules that
apply wherever you are working. Depth lives next to the code it governs, in a nested
`AGENTS.md` that loads when you open a file in that directory:

| File | Covers |
|---|---|
| `src/common/AGENTS.md` | Theming and design tokens, the UI primitives (`Button`, `Chip`, …) and design gallery, `AppHeader`, the Android edge band, dismissal touches, the web split |
| `src/pattern/data/AGENTS.md` | Storage, pattern ids, migrations, import validation, export format |
| `src/pattern/graph/AGENTS.md` | Graph model, layouts, gestures, node drag, badges, prerequisite integrity |
| `src/pattern/list/AGENTS.md` | `usePatternCrud`, modifiers, sorting, always-mounted modals |
| `src/settings/AGENTS.md` | i18n machinery, device locale, language persistence |
| `src/firebase/AGENTS.md` | Firestore sharing and its configuration |
| `__tests__/AGENTS.md` | Jest projects, the global mocks, and the traps in this suite |

The video tools (`src/anonymize/`, `src/transcribe/`, `src/suggest/`, `modules/`) have no nested
file yet; their rules are in "On-device video tools" below, and the design history in
`AGENT_TASKS.md` (L3, L4).

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
| `IVideoReference` | — | `{ type: "url" \| "local", value: string, startTime?: number, generated?, transcript? }` — `startTime` for URL videos only; `generated: { method, createdAt }` marks a video the app made (a silhouette); `transcript: IVideoTranscript` (`{ language, model, createdAt, segments: { start, end, text }[] }`) is what was said in it |

Creation helper types: `NewPattern = Omit<IPattern, "id">`, `NewModifier = Omit<IModifier, "id">`.

`PatternType.ts` also exports `PATTERN_TYPE_COLORS` (12 named hex colours), `generateUUID()`, `normalizeSlug()`, and `isSlugUnique()`.

Modifiers are affixes ("with a spin", "slow") that live on the list, not on a pattern. **Universal** ones implicitly apply to every pattern and carry their own `videoRefs`; **non-universal** ones are attached per-pattern through `IPattern.modifierRefs`, each attachment carrying its own videos of that combination.

**Pattern ids are never reused.** `IPatternList.nextPatternId` is a high-water mark; `nextPatternId(list, patterns)` in `src/pattern/data/patternIds.ts` is the only way to mint one. The manual graph layout outlives individual patterns, so a reused id would inherit a stranger's stored position.

## On-device video tools

Android only for now. Edit Pattern → Videos → **Edit video** (`src/anonymize/components/VideoEditPanel.tsx`) offers *Shorten*, *Anonymize* and *Transcribe speech*, from the labelled button beside + or the button on each video saved on the phone; the transcript sheet (`src/transcribe/components/TranscriptSheet.tsx`) hosts *Suggest name and description* (`src/suggest/`). Settings → *On-device models* (`src/settings/components/DeviceModelsSection.tsx`) lists the models, downloads them ahead of first use, and deletes them.

- **Native pieces.** `modules/video-anonymize` (Media3 trim/transcode, LiteRT person tracking, silhouette render; also backs *Shorten*) and `modules/audio-extract` (16 kHz mono PCM for Whisper) are local Expo modules, autolinked. `whisper.rn` and `llama.rn` are npm native modules. All of them need a rebuilt dev client.
- **Gate on availability, never on `Platform.OS`.** `isAnonymizeAvailable` / `canShortenVideos()`, `isAudioExtractAvailable`, and `canSuggest()` (Android, ≥ 6 GB RAM, native hash check) are false on iOS, web and Jest, and the UI hides the action.
- **One job at a time.** `jobStore` (`src/anonymize/jobs/`) queues shorten / anonymize / transcribe jobs and runs them one by one; anything else heavy (suggestions) goes through `jobStore.runExclusive`, except a transcription asked to go on and suggest, which calls `runSuggestion` inside its own turn and then waits for review like a cut. The phone cannot hold two models at once. `AnonymizeJobsProvider` exposes it to React and keeps the screen awake while jobs run; `AnonymizeJobsBanner` reports them.
- **A shortened or anonymized video waits for review** (status `review`, `VideoReviewModal`): nothing in the pattern changes until the user replaces the original, keeps both, or discards it (`jobStore.keep` / `discard`). Keeping goes through `replaceVideo.ts`: the mounted tree's attach handler when it can take it, otherwise straight to storage, since the user may have switched lists meanwhile. The new video carries only the transcript lines inside the cut, retimed (`trimTranscript`); a transcription finishes straight onto its video. Edit video offers to transcribe the whole video before a cut, queued ahead of it.
- **Providers** are pluggable (`src/anonymize/providers/`). `runAnonymize` is the only entry point, and enforces in code the trim limits and that a provider which sends footage off the device has recorded consent. The one shipped provider is on-device.
- **Models** are downloaded on first use from pinned URLs and SHA-256 checked (`src/transcribe/modelStore.ts`, specs in `src/transcribe/models.ts` and `src/suggest/models.ts`). The size is shown before any download.
- **Transcripts are private by default.** They never go into a published list (`withoutTranscripts`), and exports carry them only on the export sheet's opt-in; see `src/pattern/data/AGENTS.md`. The description is never written without the user: *Add to description* and *Use suggestion* are explicit, and a suggestion fills the name only when it is empty.
- **Web.** `src/transcribe/whisper.web.ts` stubs `whisper.rn` and `src/suggest/llama.web.ts` stubs `llama.rn`; both read their native module at import (see Platform splits below).

## Rules that apply everywhere

- **Path alias.** `@/` resolves to the **project root** (not `src/`). Use `@/src/...` for source imports and `@/utils/...` for test utilities. The same mapping is configured in `tsconfig.json` and in `jest.config.js` (`moduleNameMapper`).
- **Read-only lists.** `IPatternList.readonly` is set on imported read-only exports and on subscribed cloud lists. Every mutating path must guard on it (`const isReadonly = !!activeList?.readonly`). The one deliberate exception is dragging a graph node, which is a local view preference.
- **Translations.** All user-facing strings use `const { t } = useTranslation()`. The app ships **nine** locales — `en`, `zh`, `hi`, `es`, `fr`, `ar`, `bn`, `pt`, `de` — and a key must be added to **every** `locales/*.json` (flat key/value, no nesting), with `en` written first as the source of truth. `__tests__/unit/i18n.test.ts` fails on a key missing from any locale, an empty value, a mismatched `{{placeholder}}` set, or a `t("…")` call with no key behind it.
- **UI primitives.** Build touchables and text from `@/src/common/ui` (`Button`, `IconButton`, `Chip`, `Card`, `AppText`), not raw `TouchableOpacity`; see `src/common/AGENTS.md`. Try visual changes in the dev-only design gallery (`/gallery`, linked from Settings).
- **Theming.** Styles are Unistyles sheets declared at module level, `StyleSheet.create((theme) => …)` imported from `react-native-unistyles`, and every colour, spacing step, radius, text style and shadow comes from the design tokens in `src/common/theme/tokens.ts` — never a literal. Non-style values (icon colours, SVG fills) come from `useUnistyles()`. Text on a coloured fill uses that fill's `on*` role. Details, and the setup's traps, in `src/common/AGENTS.md`.
- **Screen edges.** `SCREEN_EDGE_INSET` is applied once as `PageContainer`'s horizontal padding, to stay clear of the Android system back-gesture band. Do not pad individual scrollers.
- **Platform splits.** Metro resolves `Foo.web.tsx` in preference to `Foo.tsx` when bundling for web, and the two files must export the same shape. The five that exist are `YouTubeVideoItem`, `PatternNodeGroup`, `ServerStyles` (web's static-render CSS), `src/transcribe/whisper` and `src/suggest/llama` (whisper.rn and llama.rn read their native module at import, which fails web's static render); route node presses through `PatternNodeGroup` rather than putting `onPress` on an SVG element directly. Verify both targets with `npx expo export --platform web` and `--platform android` — web also builds an SSR bundle, so a bad import surfaces twice.

## Filtering & sorting

`PatternFilter` (`src/pattern/filter/components/PatternFilterBottomSheet.tsx`): `{ name, types, levels, counts?, tags }`, applied by `usePatternFilter` (`src/pattern/filter/hooks/usePatternFilter.ts`) and shared by the list and graph screens. Sub-panels: `NameFilter`, `TypeFilter`, `LevelFilter`, `CountsFilter`, `TagFilter`. Sorting is in `src/pattern/list/`. Both panels render through the shared `BottomSheet` (`src/common/components/BottomSheet.tsx`).

**Never hand a filtered `patterns` array to a graph layout function** — see `src/pattern/graph/AGENTS.md`.

## Developer workflows

```bash
npm install              # install deps
npm start                # expo start --dev-client (a development build, not Expo Go)
npm run android          # expo start --android
npm run ios              # expo start --ios
npm test                 # Jest, both projects (no device needed)
npm run test:unit        # pure-logic project only — sub-second feedback loop
npm run test:components  # rendering project only (jest-expo)
npm run test:watch       # watch mode
npm run test:coverage    # coverage over all of src/, with thresholds enforced
npm run lint             # ESLint over the whole project (expo lint .)
npm run format:check     # Prettier, same glob CI uses
npm run format           # Prettier, write
npm run typecheck        # tsc --noEmit
```

Stack: Expo SDK ~57 / React Native 0.86 / React 19 / TypeScript ~6, `newArchEnabled`, typed routes and the React Compiler are on (`app.config.ts` → `experiments`). Styling is Unistyles 3 (a Nitro native module, configured through `babel.config.js` and the `index.ts` entry).

Tests live in `__tests__/`, split into a `unit` project and a `components` project; a test in the wrong directory is silently never run. See `__tests__/AGENTS.md`.

## Configuration

Config is **dynamic** — `app.config.ts` (there is no `app.json`) reads credentials from environment variables, so nothing secret is committed. Copy `.env.example` to `.env` (gitignored); the Firebase variables are listed in `src/firebase/AGENTS.md`. Without them the app runs local-only.

**Config plugins are applied only when listed in `app.config.ts` → `plugins`; autolinking does not apply them.** `expo-camera`, `expo-image-picker`, `expo-localization` and `expo-font` (the embedded Inter typeface) are listed there for that reason — the first two purely so their iOS usage strings (`NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription`, `NSMicrophoneUsageDescription`) reach the generated `Info.plist`, which iOS terminates the app without; Android's equivalent arrives via manifest merging regardless, so the omission is invisible until an iOS device runs it. "Record a video" hands over to the system camera, which on iOS records sound and so needs the microphone string; **both plugins write these iOS keys and `expo-camera`'s win** (listed first, its mods run last), so both carry the same strings — a `false` in either deletes the key. On Android the camera app records the audio itself, so camera's `recordAudioAndroid: false` keeps `RECORD_AUDIO` blocked, also against a transitive dependency merging it in. Check the resolved result with `npx expo config --type introspect`. `ios.bundleIdentifier` must stay in `app.config.ts` too: there is no `app.json`, so the CLI cannot write it, and without it `expo prebuild --platform ios` and EAS iOS builds both refuse to run.

**Build variants.** `APP_VARIANT` (`development` / `preview` / unset = production, set per profile in `eas.json`) picks the application id, launcher name and URL scheme, so the variants install side by side despite being signed by different keys. Nothing in the app may depend on the application id. Signing and Play App Signing are described in the README; no keystore is ever committed.

Note that `expo prebuild` rewrites the `android` / `ios` npm scripts to `expo run:*` — revert that, the project uses the `--dev-client` workflow. Adding a native module means rebuilding the dev client; Metro will happily serve JS the installed client has no native side for.

## Dependencies

- Do **not** run `npx expo install --fix`. Several packages are deliberately ahead of the versions SDK 57 bundles — `@react-native-async-storage/async-storage@3`, `react-native-gesture-handler@3`, `jest@30`, `react@19.2.7`, `react-native-safe-area-context`, `react-native-svg` — and `--fix` would downgrade them, two across a major. `npx expo install --check` listing them is expected.
- `react-test-renderer` is pinned to the exact `react` version and must be bumped with it. `jest-expo` must track the SDK major.
- `npm audit` findings are checked against an allowlist of reviewed advisories in `scripts/check-audit.js` (`npm run audit:check`), not a count. Accepted today: `decode-uri-component` (GHSA-vcc3-ghjq-m6fr, via `expo-router` → `query-string@7`, whose fix is ESM-only and cannot be forced under a CJS parent; waits for expo-router upstream), and `node-forge` (GHSA-86w9-cpqp-85rv, via `@expo/cli`) and `braces` (GHSA-vfj7-8cjw-p6xm, via `micromatch` under metro, jest and `@expo/cli`), both dev tooling only and with no patched release yet. Each acceptance carries an `until` date: past it the advisory fails CI again until someone re-reviews it and either fixes it or sets a new date, and the check warns in the week before. The raw counts are large because every package above them is flagged too. Any advisory not on the list is new. `overrides` in `package.json` carries the rest; each entry exists because a parent pins a range below the fix.

## Continuous integration

`.github/workflows/ci.yml` runs on every push to `master` and every PR, in three jobs, and every Monday runs the audit job alone so an expired acceptance or a new advisory shows up without a push:

- **verify** — `npm run lint`, `npm run format:check`, `npm run typecheck`, `npx jest --coverage --ci`. Lint and the format check cover the tests, mocks and root config files too: `expo lint` with no path would lint only `src/`, `app/` and `components/`, and did, until a lint error in a test went unnoticed.
- **bundle** — `npx expo export` for **both** `web` and `android`, which is the gate that catches a platform-split import fault.
- **audit** — fails if `npm audit` reports any advisory not in the accepted list in `scripts/check-audit.js`, fails when an acceptance's `until` date has passed, and warns when one is about to expire or an accepted advisory disappears. Accepting a new advisory means adding it there and to this file.

Run the same checks locally before pushing; every one of them passes on `master`.

`.github/workflows/pages.yml` is separate: on a push to `master` that touches `website/` or `PRIVACY_POLICY.md`, it renders the privacy page (`website/build-privacy.py`) and publishes `website/` to GitHub Pages. The site is static HTML and CSS with no build step; see `website/README.md`.
