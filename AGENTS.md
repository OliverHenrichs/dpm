# AGENTS.md — DancePatternMapper

Expo/React Native (TypeScript) app for mapping partner-dance prerequisite graphs: a list of
patterns (figures), each with prerequisites, videos and modifiers, shown as a list, a graph and
video reels. Android first (Play Store), iOS later, plus a static website in `website/`.

This file is the orientation layer: architecture, the shared data model, and the rules that apply
everywhere. Depth lives next to the code it governs, in a nested `AGENTS.md` that loads when you
open a file in that directory. Creating a _new_ file in a directory does not pull its `AGENTS.md`
in, so read the one listed below before you add code there.

| File | Read it before touching |
|---|---|
| `src/common/AGENTS.md` | App chrome: `AppHeader`, drawer and tabs, the Android edge band, modals and the system bars, dismissal touches |
| `src/common/theme/AGENTS.md` | Styles: Unistyles, design tokens, colour roles, fonts, the two app styles, the setup's traps |
| `src/common/ui/AGENTS.md` | The UI primitives (`Button`, `Chip`, `ListRow`, …) and the design gallery |
| `src/pattern/data/AGENTS.md` | Storage keys, write locking, pattern ids, migrations, import validation, the export format, templates |
| `src/pattern/list/AGENTS.md` | `usePatternCrud`, modifiers, sorting, always-mounted modals |
| `src/pattern/rhythm/AGENTS.md` | Rhythm notation, its link to counts, per-dance suggestions |
| `src/pattern/graph/AGENTS.md` | Graph model, filtering, layouts, pan/zoom, node drag, badges, prerequisite integrity |
| `src/reels/AGENTS.md` | The Reels tab |
| `src/anonymize/AGENTS.md` | Video jobs (`jobStore`), review, Shorten and Anonymize, providers |
| `src/transcribe/AGENTS.md` | Speech transcription (Whisper), the model store |
| `src/suggest/AGENTS.md` | Name and description suggestions (on-device LLM) |
| `modules/AGENTS.md` | The local native Expo modules and their gitignored model weights |
| `src/settings/AGENTS.md` | Settings screen, i18n machinery, device locale, language/style/icon persistence |
| `src/firebase/AGENTS.md` | Firestore sharing, ownership, security rules, configuration |
| `__tests__/AGENTS.md` | Jest projects, the global mocks (also `__mocks__/`, `utils/`), the traps in this suite |

`AGENT_TASKS.md` is the design history (bugs B*, changes S*/M*/L*, foundation F*): why things are
the way they are, with device findings. It is long; read the section a code comment cites
(`AGENT_TASKS.md L3`), not the whole file. Rules that still hold have been lifted into the
`AGENTS.md` files, which win where the two disagree.

## Architecture

```
index.ts               ← entry: registers the Unistyles themes, then expo-router
app/_layout.tsx        ← root layout (imports the themes again for web, and @/src/i18n)
  ThemeProvider        ← system/light/dark + app style
    ActivePatternListProvider  ← global state: active list + its patterns
      AnonymizeJobsProvider    ← the video job queue, exposed to React
        Drawer         ← expo-router/drawer: Lists, the (list) group, Settings
          Tabs         ← app/(list)/: the active list's List, Map and Reels
```

Navigation is **file-based expo-router**; there is no `@react-navigation/*` dependency (Expo SDK
56+ forbids importing it from app code; Metro fails the bundle). Import `Drawer` from
`expo-router/drawer`, and `useNavigation` / `useFocusEffect` / `router` / `usePathname` from
`expo-router`. Screens navigate with `router.navigate("/patterns")`, not a `navigation` prop.

| Route file | Path | Screen |
|---|---|---|
| `app/index.tsx` | `/` | `src/pattern/list/PatternListSelector.tsx` (*Lists*) |
| `app/(list)/patterns.tsx` | `/patterns` | `src/pattern/list/PatternListManager.tsx` (*List* tab) |
| `app/(list)/graph.tsx` | `/graph` | `src/pattern/graph/PatternGraphScreen.tsx` (*Map* tab) |
| `app/(list)/reels.tsx` | `/reels` | `src/reels/ReelsScreen.tsx` (*Reels* tab) |
| `app/settings.tsx` | `/settings` | `src/settings/SettingsScreen.tsx` |
| `app/gallery.tsx` | `/gallery` | `src/common/ui/DesignGallery.tsx` (dev builds only) |

Every file in `app/` becomes a route, so route files are one-line re-exports and the code lives in
`src/`. A group does not change a URL. `src/common/components/DrawerRoutes.ts` is the single source
of truth for both navigators (`DRAWER_ROUTES`, `LIST_TABS`: name, href, i18n title key, icon,
whether the header shows the list's name), read by the drawer, the tab layout
(`ListTabsLayout.tsx`), the drawer menu and `AppHeader`. A new view of a list is a tab; a new place
is a drawer entry; either way, add it there and in `app/`.

**State.** Screens read `activeList`, `patterns`, `isLoading` and `hasLists` from
`useActivePatternList()` (`src/pattern/data/components/ActivePatternListContext.tsx`) and **never
load storage directly** (Reels' all-lists view is the one reader of other lists). The context
mutates through `setActiveList`, `updatePatterns`, `updateActiveList(list, patternsOverride?)` and
`refreshActiveList`; pattern and modifier edits go through `usePatternCrud`, never the context
directly.

## Core data model

All in `src/pattern/types/` (`IPatternList.ts`, `PatternType.ts`, `PatternLevel.ts`, `Dance.ts`).

| Type | Id | Key detail |
|---|---|---|
| `IPatternList` | UUID string | Owns its `patternTypes` **and** `modifiers` (per list, not global). Optional `readonly` (subscribed or read-only import), `shareCode` (Firestore doc id), `shareKey` (publisher's secret, never published), `dance` (picks rhythm suggestions), `nextPatternId` (id high-water mark) |
| `PatternType` | UUID string | `slug` is the display name, `color` a hex; patterns point at it by `typeId` |
| `IPattern` | integer | `prerequisites: number[]` drives both graph views; `typeId`; `counts`; `tags: string[]`; optional `level`, `rhythm` (always matches `counts`); `videoRefs`; `modifierRefs` |
| `IModifier` | UUID string | `position: "prefix" \| "postfix" \| "amends"`; `universal`; `videoRefs` used only when universal |
| `IPatternModifierRef` | — | `{ modifierId, videoRefs }`: a non-universal modifier attached to one pattern, with videos of that pattern danced with it |
| `IVideoReference` | — | `{ type: "url" \| "local", value, startTime?, generated?, transcript? }`; `startTime` for URLs only; `generated` marks a video the app made; `transcript` is what was said in it |

`NewPattern = Omit<IPattern, "id">`, `NewModifier = Omit<IModifier, "id">`. `PatternType.ts` also
exports `PATTERN_TYPE_COLORS`, `generateUUID()`, `normalizeSlug()` and `isSlugUnique()`.

Modifiers are affixes ("with inside turn", "hesitation") that live on the list. **Universal** ones
apply to every pattern and carry their own videos; **non-universal** ones are attached per pattern
through `modifierRefs`, each attachment with its own videos. A variation of a pattern is a modifier
on it, not a new pattern.

**Pattern ids are never reused**: mint them only with `nextPatternId(list, patterns)`
(`src/pattern/data/patternIds.ts`). The manual graph layout outlives patterns, so a reused id would
inherit a stranger's position.

## Rules that apply everywhere

- **Path alias.** `@/` is the **project root**, not `src/`: `@/src/...` for source, `@/utils/...`
  for test helpers, `@/modules/...` for the native modules. Mapped in `tsconfig.json` and
  `jest.config.js`.
- **Read-only lists.** Every mutating path guards on `const isReadonly = !!activeList?.readonly`.
  The one deliberate exception is dragging a graph node, a local view preference.
- **Translations.** Every user-facing string is `t("key")` from `useTranslation()`. A key goes in
  **all nine** `locales/*.json` (`en`, `zh`, `hi`, `es`, `fr`, `ar`, `bn`, `pt`, `de`; flat
  key/value), `en` first. `__tests__/unit/i18n.test.ts` fails on a missing key, an empty value, a
  mismatched `{{placeholder}}` set, or a `t("…")` with no key behind it. The dev-only gallery is
  the one untranslated screen.
- **UI primitives.** Touchables and text come from `@/src/common/ui` (`Button`, `IconButton`,
  `Chip`, `Card`, `ListRow`, `AppText`, …), not raw `TouchableOpacity`/`Text`.
- **Styles.** Unistyles sheets at module level, `StyleSheet.create((theme) => …)` from
  `react-native-unistyles`; every colour, spacing, radius, text style and shadow is a token from
  `src/common/theme/tokens.ts`, never a literal (colour literals fail lint). Non-style values (icon
  colours, SVG fills, navigator options) come from `useUnistyles()`. Text on a fill uses that
  fill's `on*` role. Two app styles, each light and dark, share every token name.
- **Screen edges.** `SCREEN_EDGE_INSET` is applied once, as `PageContainer`'s horizontal padding,
  to keep clear of Android's back-gesture band. Do not pad individual scrollers.
- **Platform splits.** Metro prefers `Foo.web.tsx` over `Foo.tsx` for web; both must export the
  same shape. The six today: `YouTubeVideoItem`, `PatternNodeGroup`, `theme/ServerStyles`,
  `src/transcribe/whisper`, `src/suggest/llama`, `src/firebase/auth`. Route graph node presses
  through `PatternNodeGroup`, never `onPress` on an SVG element.
- **A package that reads its native module at import** takes the app down on a build without it,
  before any `try` runs. Either split it per platform (above) or `require` it inside a function
  wrapped in `try`, as `src/settings/data/DeviceLocale.ts`, `src/settings/appIcon.ts` and
  `src/anonymize/jobs/jobNotifications.ts` do; keep those requires where they are.
- **Gate on availability, not `Platform.OS`**, for anything native and optional
  (`isAnonymizeAvailable`, `isAudioExtractAvailable`, `canSuggest()`, `supportsAlternateIcons`).
  Those are false on web and under Jest, and the UI hides the action.
- **Native changes need a rebuilt dev client.** Metro will happily serve JS the installed client
  has no native side for.
- **Verify both bundles** with `npx expo export --platform web` and `--platform android`. Web also
  builds an SSR bundle, so a bad import surfaces twice.

## On-device video tools (Android only for now)

Edit Pattern → Videos → **Edit video** (`src/anonymize/components/VideoEditPanel.tsx`) offers
*Shorten*, *Anonymize* (a silhouette) and *Transcribe speech*; the transcript sheet offers *Suggest
name and description*. Settings → *On-device models* downloads and deletes the models. Everything
heavy runs through one queue, `jobStore`, one job at a time, because the phone cannot hold two
models. A shortened or anonymized video waits for the user's review before the pattern changes,
and nothing is written into a description without an explicit tap. Transcripts never go into a
published list and leave in an export only on opt-in. Details in `src/anonymize/`,
`src/transcribe/`, `src/suggest/` and `modules/` (their `AGENTS.md`).

## Filtering

`PatternFilter` (`{ name, types, levels, counts?, tags }`, in
`src/pattern/filter/components/PatternFilterBottomSheet.tsx`) is applied by `usePatternFilter`
(`src/pattern/filter/hooks/`) and shared by the List and Map tabs. Sorting is in
`src/pattern/list/`. **Never hand a filtered `patterns` array to a graph layout function**; see
`src/pattern/graph/AGENTS.md`.

## Developer workflows

```bash
npm install              # install deps
npm start                # expo start --dev-client (a development build, not Expo Go)
npm run android          # expo start --android
npm test                 # Jest, both projects (no device needed)
npm run test:unit        # pure-logic project only, sub-second loop
npm run test:components  # rendering project only (jest-expo)
npm run test:rules       # Firestore rules in the emulator (needs Java 21+)
npm run test:coverage    # coverage over all of src/, thresholds enforced
npm run lint             # ESLint over the whole project (expo lint .)
npm run format:check     # Prettier, same glob CI uses (npm run format writes)
npm run typecheck        # tsc --noEmit
```

Stack: Expo SDK ~57, React Native 0.86, React 19, TypeScript ~6, new architecture, typed routes and
the React Compiler on (`app.config.ts` → `experiments`). Styling is Unistyles 3. Animation and
gestures are Reanimated 4 and Gesture Handler 3. Because the React Compiler is on, read and write
shared values with `.get()` / `.set()`, never `.value`.

Tests live in `__tests__/unit/` or `__tests__/components/`; a test in the wrong directory is
silently never run.

## Configuration and builds

Config is **dynamic**: `app.config.ts` (there is no `app.json`) reads credentials from environment
variables. Copy `.env.example` to `.env` (gitignored); without the Firebase variables
(`src/firebase/AGENTS.md`) the app runs local-only.

- **Config plugins apply only when listed in `app.config.ts` → `plugins`;** autolinking does not
  apply them. `expo-camera` and `expo-image-picker` are listed for their iOS usage strings, without
  which iOS kills the app. **Both write the same keys and `expo-camera`'s win** (listed first, its
  mods run last), so both carry the same strings; a `false` in either deletes the key. Camera's
  `recordAudioAndroid: false` keeps `RECORD_AUDIO` out on Android (the camera app records the
  sound). Check the result with `npx expo config --type introspect`.
- `ios.bundleIdentifier` must stay in `app.config.ts`: with no `app.json` the CLI cannot write it,
  and iOS prebuild and EAS iOS builds refuse to run without it.
- **Build variants.** `APP_VARIANT` (`development` / `preview` / unset = production, per profile in
  `eas.json`) picks the application id, launcher name and URL scheme, so the variants install side
  by side. Nothing in the app may depend on the application id. Signing is in the README; no
  keystore is ever committed.
- **App icon colour** (Settings, `src/settings/appIcon.ts`) switches between icon sets that
  `expo-alternate-app-icons` registers at build time. A new colour means icon files in
  `assets/images/icon-colors/`, entries in the plugin list, `APP_ICON_COLORS` (tokens.ts) and
  `appIcon.ts`, and a rebuilt dev client. The splash stays indigo.
- **EAS uploads by `.easignore`, not `.gitignore`.** It exists so the gitignored model weights
  reach Android builds, and the `eas-build-pre-install` hook fails a build without them
  (`modules/AGENTS.md`). A new `.gitignore` entry belongs in `.easignore` too.
- `expo prebuild` rewrites the `android` / `ios` npm scripts to `expo run:*`; revert that, the
  project uses the `--dev-client` workflow.

## Dependencies

- Do **not** run `npx expo install --fix`. Several packages are deliberately ahead of SDK 57's
  versions (`@react-native-async-storage/async-storage@3`, `react-native-gesture-handler@3`,
  `jest@30`, `react@19.2.7`, `react-native-safe-area-context`, `react-native-svg`), and `--fix`
  would downgrade them. `npx expo install --check` listing them is expected.
- `react-test-renderer` is pinned to the exact `react` version and moves with it. `jest-expo`
  tracks the SDK major.
- **Audit.** `npm run audit:check` (`scripts/check-audit.js`) fails on any advisory not in its
  allowlist, and on an acceptance past its `until` date; it warns a week before. Each acceptance
  there carries its reason. To accept a new one, add it there with a reason and a date. The raw
  `npm audit` counts are large because every parent of a flagged package is flagged too.
  `overrides` in `package.json` carries the rest; each entry exists because a parent pins a range
  below the fix.

## Continuous integration

`.github/workflows/ci.yml` runs on every push to `master` and every PR (and the audit job alone
every Monday):

- **verify**: lint, format check, typecheck, `npx jest --coverage --ci`. Lint and format cover
  tests, mocks and root config too.
- **bundle**: `npx expo export` for `web` and `android`, the gate for platform-split faults.
- **rules**: `firestore.rules` in the emulator.
- **audit**: `scripts/check-audit.js`.

All four pass on `master`; run the same checks locally before pushing.
`.github/workflows/pages.yml` publishes `website/` (static HTML/CSS, see `website/README.md`) and
the rendered `PRIVACY_POLICY.md` to GitHub Pages on a push to `master` touching either. A new
permission or data flow belongs in `PRIVACY_POLICY.md`.
