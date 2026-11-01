# DPM (Dance Pattern Mapper)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Expo SDK](https://img.shields.io/badge/Expo-~57.0-blue?logo=expo)](https://expo.dev)
[![React Native](https://img.shields.io/badge/React%20Native-0.86-61dafb?logo=react)](https://reactnative.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178c6?logo=typescript)](https://www.typescriptlang.org)

> **Status:** Work in Progress 🚧 · **Website:** [dancepatternmapper.com](https://dancepatternmapper.com/)

A React Native / Expo mobile app for mapping partner-dance patterns as a prerequisite graph.  
Organise patterns into dance-style-specific lists, visualise their dependencies in a swimlane timeline or a zoomable network graph, browse their videos as reels, and share your lists with other dancers through live cloud sync.

---

## Features

The full description of what the app does, area by area, is in
[`docs/product/`](docs/product/overview.md). In short:

- **Lists and figures**: lists from six dance templates or blank; figures with prerequisites,
  counts, a rhythm in dancers' notation, level, tags, videos and modifiers (variations with their
  own videos). Sort, filter, compact mode.
- **Map**: the prerequisite graph as a timeline of type lanes (reorderable) or a pannable network
  (figures movable by hand), with filtering that keeps the chains around a match.
- **Reels**: every figure with a video, one per screen.
- **Video tools (Android)**: shorten, anonymize (silhouettes or faces only), transcribe speech and
  draft a name and description, all on the phone; put a video online through your own apps.
- **Sharing**: publish a list with a share code or QR code, follow it read-only, suggestions of
  figures and changes, members-only lists, handing a list over, reports. No accounts.
- **Settings**: two app styles in light and dark, nine languages, app icon colour, export and
  import for backups and new phones, on-device models, what's new.

---

## Tech Stack

| Layer | Library / Version |
|---|---|
| Framework | [Expo](https://expo.dev) ~57 / React Native 0.86 / React 19 |
| Navigation | [Expo Router](https://expo.github.io/router) file-based routing + its built-in `Drawer` layout |
| Persistence | [@react-native-async-storage/async-storage](https://github.com/react-native-async-storage/async-storage) |
| Cloud sync | [Firebase](https://firebase.google.com) (Firestore, anonymous Authentication) ^12 |
| Styling | [react-native-unistyles](https://www.unistyl.es) 3 — every colour, spacing step and text style comes from the design tokens in `src/common/theme/tokens.ts` |
| Graphics | [react-native-svg](https://github.com/software-mansion/react-native-svg) 15 |
| Gestures & animation | [react-native-gesture-handler](https://docs.swmansion.com/react-native-gesture-handler) + [react-native-reanimated](https://docs.swmansion.com/react-native-reanimated) — pan, pinch and node dragging all run on the UI thread |
| Video | [expo-video](https://docs.expo.dev/versions/latest/sdk/video) + [expo-video-thumbnails](https://docs.expo.dev/versions/latest/sdk/video-thumbnails) |
| Video processing | Local Expo modules in `modules/` (Kotlin): `video-anonymize` (AndroidX Media3 + LiteRT person tracking) and `audio-extract` |
| On-device AI | [whisper.rn](https://github.com/mybigday/whisper.rn) (speech to text) + [llama.rn](https://github.com/mybigday/llama.rn) (suggestions) |
| YouTube | [react-native-youtube-iframe](https://lonelycpp.github.io/react-native-youtube-iframe) |
| QR codes | [react-native-qrcode-svg](https://github.com/awesomejerry/react-native-qrcode-svg) + [expo-camera](https://docs.expo.dev/versions/latest/sdk/camera) |
| File / Share | [expo-file-system](https://docs.expo.dev/versions/latest/sdk/filesystem) + [expo-sharing](https://docs.expo.dev/versions/latest/sdk/sharing) + [expo-document-picker](https://docs.expo.dev/versions/latest/sdk/document-picker) |
| App icon | [expo-alternate-app-icons](https://github.com/pchalupa/expo-alternate-app-icons) |
| Notifications | [expo-notifications](https://docs.expo.dev/versions/latest/sdk/notifications) (local only, for finished video work) |
| i18n | [i18next](https://www.i18next.com) + [react-i18next](https://react.i18next.com) |
| Language | TypeScript ~6.0 |
| Testing | Jest 30 + ts-jest + @testing-library/react-native — **1481 tests** across two projects, plus the Firestore rules tests |

The new architecture, typed routes and the React Compiler are enabled in `app.config.ts`.

---

## Project Structure

```
app/                     Expo Router routes: _layout (drawer) + one file per screen
  └─ (list)/             The open list's tabs: patterns (List), graph (Map), reels
locales/                 one <code>.json translation resource per language
src/common/              Theme, palette, drawer menu, shared components (dialogs, bottom sheet, video)
src/i18n.ts              i18next bootstrap, imported by the root layout
src/pattern/types/       IPatternList, IPattern, IModifier, PatternType, PatternLevel
src/pattern/data/        AsyncStorage layer, export/import, id allocation, templates
  ├─ validation/         Runtime validation of imported files
  └─ migrations/         Versioned, forward-only schema migrations
src/pattern/list/        List & modifier screens, edit forms, share/subscribe modals
src/pattern/rhythm/      Rhythm notation, its link to counts, per-dance suggestions
src/pattern/filter/      Filter bottom sheet, its sub-panels and the shared filter hook
src/pattern/graph/       Timeline + network views, details modal
  ├─ model/              Pure graph maths: adjacency, cycles, depth, filtering, layout merge
  ├─ render/             Shared SVG primitives and the drag overlay
  └─ data/               Per-list manual layout storage
src/reels/               The Reels tab: overview, one-per-screen pager, players
src/anonymize/           Edit-video sheet, shorten / anonymize jobs and the job banner
  ├─ jobs/               Background job store, one native job at a time
  └─ providers/          Anonymization methods (on-device tracking)
src/transcribe/          Speech-to-text jobs, model downloads, transcript sheet
src/suggest/             Name and description suggestions from a transcript
src/firebase/            Optional Firestore config, anonymous sign-in and list-sharing service
src/settings/            Settings screen, data-transfer hook, on-device model management
modules/                 Local native Expo modules: video-anonymize, audio-extract (Android)
website/                 Static project website, deployed to GitHub Pages (see website/README.md)
__mocks__/               Behavioural mocks: AsyncStorage, filesystem, Reanimated, gestures
__tests__/ , utils/      Jest tests and test factories
```

See [AGENTS.md](AGENTS.md) for a deeper architecture walkthrough and the project's conventions.

---

## Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Start the dev server for the development client
npm start                 # → expo start --dev-client

# Or target a specific platform
npm run android
npm run ios
npm run web
```

The app runs in a **development build** (`expo-dev-client`), not Expo Go: it ships native modules
(`modules/`, `whisper.rn`, `llama.rn`) that Expo Go does not contain. Build one with
`eas build --profile development` or locally with `npx expo run:android`, and rebuild it whenever a
native module is added or changed. Note that `expo prebuild` / `expo run:*` rewrite the `android` and
`ios` npm scripts; revert that.

### On-device model weights

The Anonymize models (about 130 MB) are **not in git**. `npm run assets:fetch` downloads them into
`modules/video-anonymize/android/src/main/assets/` from the `models-v1` GitHub Release; the
scripts in `modules/video-anonymize/scripts/` export them from scratch (see
[modules/AGENTS.md](modules/AGENTS.md)). `.easignore` lets EAS upload them although `.gitignore`
excludes them, and `npm run assets:check` runs as the `eas-build-pre-install` hook: an Android EAS
build without them downloads them, and fails instead of shipping a build whose Anonymize cannot
work when that fails. Keep `.easignore` in step with `.gitignore`.

### Build variants and signing

Android will not install an update signed with a different certificate than the installed app
(`INSTALL_FAILED_UPDATE_INCOMPATIBLE`), and this app is signed by up to three different keys: the
debug keystore of a local `expo run:android`, the keystore EAS keeps for cloud builds, and Google's
app signing key for anything installed from the Play Store. So each build variant gets its own
application id, chosen by `APP_VARIANT` in `app.config.ts`, and they install side by side:

| `APP_VARIANT` | Application id | Launcher name | Built by | Signed with |
|---|---|---|---|---|
| `development` | `com.teholi.DancePatternMapper.dev` | DPM (Dev) | `eas build --profile development`, or `APP_VARIANT=development npx expo run:android` | EAS keystore, or the local debug keystore |
| `preview` | `com.teholi.DancePatternMapper.preview` | DPM (Preview) | `eas build --profile preview` (APK, sideload) | EAS keystore |
| unset / `production` | `com.teholi.DancePatternMapper` | DPM | `eas build --profile production` (AAB, for Play), or `--profile production-apk` (an APK of the same build, to install directly) | EAS keystore as **upload key**; Play re-signs with the app signing key |

`eas.json` sets the variable for each profile. Locally, set it yourself for a development client;
without it you build the production id, which then collides with whatever is installed under it.
A local debug build and an EAS development build are still two keys for one id, so stick to one
of them; switching means uninstalling the dev app (it holds only test data).

Each variant has its own storage, so lists on the phone's production install are not visible in the
dev app. Move them across with export / import if you need them.

**Release signing (Play App Signing).** No keystore lives in this repository (`*.jks`, `*.keystore`
are gitignored) and none should. EAS generates and stores the Android keystore on the first
`eas build --profile production` (`eas credentials -p android` to inspect, or to download a backup —
keep that backup outside the repo). In Play Console, enrol in Play App Signing and let Google
generate the app signing key; the EAS keystore is then only the upload key, and a lost upload key
can be reset through Play support rather than losing the app. The first AAB has to be uploaded by
hand in Play Console; `eas submit` works after that.

**Uploading to Play from EAS.** `npm run release:android` (`eas build --platform android --profile
production --auto-submit`) builds the AAB and hands it straight to Play's closed testing track
(`alpha`, set under `submit` in `eas.json`). `npm run submit:android` sends the latest existing
build.
Submitting needs a Google service account key, held by EAS and never committed:

1. In Google Cloud (any project), create a service account and download a JSON key for it.
2. In Play Console → *Users and permissions*, invite the service account's email and grant it
   release permissions for DPM.
3. Run `eas credentials -p android`, choose the production build, then *Google Service Account* →
   upload the JSON key, and assign it under *Manage your Google Service Account Key for Play Store
   Submissions*. An uploaded key that is not assigned makes every submit ask which key to use.

**Releasing without a local checkout.** `.eas/workflows/release-android.yml` runs the same build and
submission on EAS: it starts when a version tag (`v1.4.0`, …) is pushed, for example by publishing
a GitHub Release from the merged release commit on master (github.com or the GitHub app), or by
hand with `eas workflow:run .eas/workflows/release-android.yml` or from the project's _Workflows_
page on expo.dev. It needs the Expo project linked to the GitHub repository (expo.dev → project
settings → GitHub). The build fetches the model weights itself.

A local build uses the weights in the checkout (see `modules/AGENTS.md`), as for any production
build. To publish to another track later, change `track` (`internal`, `alpha`, `beta`,
`production`, or a custom closed track's name).

### Running Tests

Tests are split into two Jest projects. Most logic lives in `unit`, which runs in plain Node and
gives a sub-second feedback loop; anything that renders goes in `components`, which pays for the
React Native environment. A test in the wrong directory is silently never run.

```bash
npm test                  # both projects
npm run test:unit         # pure logic only — fast
npm run test:components   # rendering only
npm run test:watch        # watch mode
npm run test:coverage     # coverage, with per-file thresholds enforced
npm run lint              # ESLint via expo lint
npm run typecheck         # tsc --noEmit
npm run format:check      # Prettier, same glob CI uses
npm run test:rules        # Firestore security rules in the emulator (needs Java 21+)
```

CI runs all of the above on every push and pull request, plus an `expo export` for **both** web and
Android — Metro resolves `.web.tsx` over `.tsx`, so a bad import can break exactly one platform —
and an `npm audit` check against a documented baseline.

### Firebase Setup

Cloud sharing is **optional**. Without Firebase credentials the app runs fully offline and the publish/subscribe UI is hidden.

To enable it, create a `.env` file in the project root (see `.env.example`) with your Firebase project credentials:

```dotenv
FIREBASE_API_KEY=...
FIREBASE_AUTH_DOMAIN=...
FIREBASE_PROJECT_ID=...
FIREBASE_STORAGE_BUCKET=...
FIREBASE_MESSAGING_SENDER_ID=...
FIREBASE_APP_ID=...
FIREBASE_MEASUREMENT_ID=...
FIREBASE_APP_TOKEN=...   # write token used by the publish flow, checked by your Firestore Security Rules
```

`app.config.ts` reads these into `extra.firebase` at build time — no credentials are committed to the repository.  
Expo loads `.env` automatically when running `expo start` or `eas build`.  
For EAS cloud builds, add each variable as an [EAS Secret](https://docs.expo.dev/build-reference/variables/#using-secrets-in-eas-build).

In the Firebase console, enable **Anonymous** sign-in (Authentication → Sign-in method); publishing
fails without it. The security rules live in `firestore.rules`: only a list's publisher may update
or delete it, and nobody can browse the published lists. Test them with `npm run test:rules` and
deploy them with `npm run rules:deploy` (`firebase login` once; the project id comes from `.env`).
Deploying changes production for every installed app, so deploy rules that require sign-in only once
builds that sign in are what people run. Details in [src/firebase/AGENTS.md](src/firebase/AGENTS.md).

---

## Website

`website/` is a static site (plain HTML and CSS, no build step) that introduces DPM and hosts the
privacy policy, rendered from [PRIVACY_POLICY.md](PRIVACY_POLICY.md). `.github/workflows/pages.yml`
publishes it to GitHub Pages on every push to `master` that touches it. Preview it with
`python3 -m http.server 8765 --directory website`; details in [website/README.md](website/README.md).
