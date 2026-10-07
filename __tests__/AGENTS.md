# Testing — `__tests__/`

Also governs `__mocks__/`, `utils/` (test helpers) and the `jest.setup.*.ts` files, which sit
outside this directory and will not pull this file in on their own.

## Layout

All tests live here (not co-located), named `*.test.ts(x)`. Jest runs **two projects**
(`jest.config.js`); a test in the wrong directory is **silently never run**.

| Project | Directory | Environment | Use it for |
|---|---|---|---|
| `unit` | `__tests__/unit/` | `node` + `ts-jest` | Pure logic: storage, graph maths, parsers, helpers. Fast; most tests belong here. |
| `components` | `__tests__/components/` | `jest-expo` preset | Anything that renders, and hooks that need the providers. |

`npm test` runs both, `npm run test:unit` / `test:components` one. `__tests__/rules/` holds the
Firestore security-rules tests, outside `jest.config.js` on purpose: they need the emulator (Java
21+), have their own `jest.rules.config.js`, and run only through `npm run test:rules`.

## Writing a test

- **Render through `renderWithProviders`** (`utils/renderWithProviders.tsx`): the real provider
  stack (i18n, `ThemeProvider`, `ActivePatternListProvider`), with storage seeded before mounting.
  It re-exports `@testing-library/react-native`; import `screen`, `fireEvent`, `within` from it.
  `renderHookWithProviders` mounts a hook the same way.
- **Build data with `utils/testFactories.ts`** (`createTestPattern`, `createTestPatternList`,
  `createTestPatternType`), not raw literals. A new required field belongs in the factories.
  Pattern ids are plain integers; type, list and modifier ids use `generateUUID()`.
- **Assert on observable state**, `await loadPatterns(id)`, not on mock bookkeeping
  (`setItem.mock.calls[0][1]`), so tests survive refactors of storage internals.
- **Export and import are tested as a round trip** (`unit/ExportImportRoundTrip.test.ts`): the two
  only agree through the on-disk format. Add a case there when changing either side or the version.
- **The Android back button is testable**: `fireEvent(modal, "requestClose")` exercises
  `onRequestClose`, a real user action worth covering.
- **`test.failing` marks a known defect**: it passes while the bug exists and fails once fixed.
  Prefer it to deleting or skipping a test that documents real broken behaviour.

## Global mocks

Every file in `__mocks__/` beside `node_modules` applies automatically, with no `jest.mock()` call.
Both setup files reset the stateful ones before each test.

| Mock | What it gives a test |
|---|---|
| `@react-native-async-storage/async-storage` | A real in-memory store (v3 surface). `seedAsyncStorage` / `peekAsyncStorage`. |
| `expo-file-system` (+ `/legacy`) | In-memory `File` / `Paths` with real bytes and base64, so no test touches disk and a round trip must preserve bytes. `seedFile` / `seedBinaryFile`, `readFileBytes` / `readFileText` / `listFileUris`. Throws on any surface the app does not use, so a new call site shows up here. jest-expo mocks `/legacy` itself, so `jest.setup.components.ts` re-registers ours (the legacy API has the download progress callback). |
| `expo-crypto` | `getRandomValues` from Node's CSPRNG (storage mints share keys). |
| `expo-localization` | A US-English device by default; `setDeviceLocales` picks another. |
| `expo-alternate-app-icons` | A device that supports alternate icons; `setAlternateIconsSupported(false)` one that does not. |
| `whisper.rn` | Contexts with `transcribe` / `detectSpeech`; a test sets what speech is found and what each call returns, and sees every call. |
| `llama.rn` | `initLlama` with `completion` / `release`; `setLlamaAnswer` sets the model's answer (an `Error` rejects), `llamaCalls` records calls. |
| `react-native-reanimated`, `react-native-worklets` | Hand-written; see below. |
| `react-native-gesture-handler` | Hand-written; records every gesture a component registers. |

Mocked in `jest.setup.components.ts` instead: expo-video, expo-camera, the pickers, haptics,
sharing, the YouTube player, QR codes, and the firebase SDK (`firebase/app`, `/firestore`, `/auth`
ship untranspiled ESM jest cannot parse). The local native modules in `modules/` resolve to
nothing under Jest, so `isAnonymizeAvailable` and `isAudioExtractAvailable` are false and the video
tools are hidden unless a test mocks them in.

**Reanimated and Gesture Handler.** Reanimated's real entry initialises the worklets runtime on
import, which reaches a native module that does not exist; its shipped mock re-imports that entry,
so it does not help. Ours are behavioural where it is useful:

- Shared values really hold and update. `useAnimatedStyle` returns its factory's **first** result
  and never re-runs, so a view whose animated opacity starts at 0 (`BottomSheet`'s scrim) counts as
  hidden; query with `{ includeHiddenElements: true }`.
- Layout animations are chainable no-ops. `withTiming` / `withSpring` land at once and report
  finished; `setTimingFinishes(false)` models an interrupted animation, `setReducedMotion(true)`
  the system setting (both reset by `resetReanimatedMock`).
- `peekGestures()` / `findGesture()` let a test call a component's gesture handlers with synthetic
  events. That covers the pan/pinch/zoom arithmetic (`ZoomableCanvas.test.tsx`) and the node drag
  at every zoom (`useNodeDrag.test.tsx`). What no test here covers: whether gestures arbitrate
  correctly, how motion feels, and whether a tap still reaches a node under a pan. Device checks.

**Unistyles** runs on its shipped mock (`react-native-unistyles/mocks`, then the app's theme
registration). Every sheet resolves against the light theme at import, insets are zero, and a test
cannot observe a theme or style switch.

**Firebase** is unavailable under Jest, always: `firebaseAvailable` derives from
`Constants.expoConfig.extra.firebase`, which jest-expo does not populate, so the sharing screens
render their "not configured" branch. A suite testing the available path mocks
`@/src/firebase/firebaseConfig` with a getter it can flip (`ShareListModal.test.tsx`). Tests that
need sharing mock `@/src/firebase/FirebaseListService`, **including `subscribeToSharedList`**: a list
with a `shareCode` activates the provider's live subscription.

## Traps

- **`clearMocks: true`** (both projects) resets call history _and_ factory implementations before
  each test. A mock whose return value matters must set it in `beforeEach`; otherwise it returns
  `undefined`, and code calling `.catch()` on it fails as `window.dispatchEvent is not a function`.
- **Wait on something the _data_ produced, not on chrome.** The provider loads storage on mount, so
  "zero patterns" is true on the first render, and a header renders before the read lands. Anchor
  on a value only loaded data can produce (`await screen.findByText(lists[0].name)`), and on each
  key when a screen reads several (`PatternListManager` reads `@patternLists` and `@patterns_<id>`).
- **Never poll for absence with `waitFor`.** `waitFor(() => expect(queryByX()).toBeNull())` can
  still observe the pre-update tree when its budget expires on a loaded CI runner. Wait on something
  positive (a node appearing, a mock called, storage reaching a value), then assert absence
  synchronously. Reproduce contention with `for i in $(seq 8); do (while :; do :; done) & done`.
- **`VideoCarousel` renders nothing until measured**: fire
  `fireEvent(view, "layout", { nativeEvent: { layout: { width: 320 } } })`.
- **A callback that is not a touch event** (`onViewableItemsChanged`) is called through the prop;
  wrap it in `act()` or its state update never lands.
- **Timeouts are sized for a cold CI runner.** `npm ci` wipes the Babel cache, so the first
  component test transforms the whole RN + Expo tree (~300ms warm, ~3.5s cold). Hence `testTimeout`
  60s and RNTL's `asyncUtilTimeout` 10s. **`testTimeout` works only at the config root**; inside a
  project entry Jest ignores it with only an "Unknown option" warning. Reproduce the cold path with
  `npx jest --clearCache && rm -rf node_modules/.cache`.
- **`tsconfig.jest.json` must not override `jsx`.** Components rely on the automatic runtime
  (importing only `FC`/`ReactNode`); the classic transform fails them with `TS2686: 'React' refers
  to a UMD global`, which shows only as `Failed to collect coverage from …`, does not fail the run,
  and silently drops those files from coverage.

## Coverage thresholds

A ratchet in `jest.config.js` → `coverageThreshold`, set just under measured reality. Raise them as
suites land; never lower them.

- A file with its own entry is **removed from the `global` pool**, so pinning well-covered files
  pushes the global number _down_.
- A file imported by both projects is instrumented twice and drifts between run modes; floor it
  under the lowest of `npx jest --coverage`, `--ci --maxWorkers=2` and `--maxWorkers=1`.
- The global figure varies by several points between identical runs; measure a few times and floor
  under the worst.
- Key off the numbers Jest prints when a threshold is _missed_, not the summary table's; they use
  different denominators.
