# DPM (Dance Pattern Mapper)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Expo SDK](https://img.shields.io/badge/Expo-~57.0-blue?logo=expo)](https://expo.dev)
[![React Native](https://img.shields.io/badge/React%20Native-0.86-61dafb?logo=react)](https://reactnative.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178c6?logo=typescript)](https://www.typescriptlang.org)

> **Status:** Work in Progress 🚧 · **Website:** [oliverhenrichs.github.io/dpm](https://oliverhenrichs.github.io/dpm/)

A React Native / Expo mobile app for mapping partner-dance patterns as a prerequisite graph.  
Organise patterns into dance-style-specific lists, visualise their dependencies in a swimlane timeline or a zoomable network graph, browse their videos as reels, and share your lists with other dancers via export/import or live cloud sync.

---

## Features

### Navigation
- The **drawer** holds the places: **Lists** (all your pattern lists) and **Settings**
- Inside the open list, **bottom tabs** switch between its views: **List** · **Map** · **Reels**

### Pattern Lists
- Create pattern lists for any dance style — choose from **five built-in templates** (West Coast Swing, Salsa, Bachata, Argentine Tango, Lindy Hop) or start from a **blank list**
- Templates come with preset pattern types *and* a handful of foundational starter patterns
- Each list owns its own set of **custom pattern types** with individually assigned colours
- A list can name its **dance** (West Coast Swing, Lindy Hop, Salsa, Bachata, Argentine Tango), which picks the rhythms suggested for its patterns; templates set it
- Edit list name, dance and pattern types at any time (types with patterns cannot be removed)
- Delete lists individually; the active list persists across sessions

### Pattern Management
- Full **CRUD** for patterns within a list
- Per-pattern fields: name, type, counts, an optional **rhythm**, an optional level (Beginner / Intermediate / Advanced), description, free-form **tags**, **prerequisite links** to other patterns, one or more **videos** (local file or URL with optional start time), and attached **modifiers**
- **Rhythm** is written the way dancers count it (`1 2 3&4 5&6` for a West Coast Swing six-count pattern, `a` for a swung triple, `(4)` for a beat without a weight change) and always matches the counts: typing a rhythm sets the counts, and changing the counts drops a rhythm that no longer fits. While the field is empty it suggests the dance's basic rhythms for those counts, then offers the next step to append
- Rows show the type, the level when set and the number of videos; the counts are in the opened details
- Supports **online videos** including YouTube links with in-app playback
- Inline video thumbnails with a swipeable carousel in both the edit form and the detail view
- Start a new pattern **from a video**, picked from the gallery or **recorded** with the system camera; the video seeds the form. Picked videos are copied into the app's own storage, so they survive the OS clearing its cache

### Modifiers
Modifiers are affixes that change how a pattern is danced ("with a spin", "slow", "hijacked"). They are defined per list, on their own tab next to the patterns:

- Each modifier has a **position** — *prefix* (precedes), *postfix* (follows) or *within* (changes it from inside; stored as `amends`)
- **Universal** modifiers apply to every pattern in the list and carry their own demo videos
- **Non-universal** modifiers are attached to individual patterns, and each attachment can hold videos of *that* pattern danced with *that* modifier
- A modifier's detail view lists every pattern it is attached to; deleting a modifier detaches it from all patterns

### Video Tools (Android)
**Edit Pattern → Videos → Edit video** opens a sheet with the clip and a trim bar. Everything below runs **on the device**. No video, audio or transcript is uploaded, and each tool runs as a background job reported in a banner on the pattern list, with a phone notification when it finishes while the app is in the background.

- **Shorten** cuts the selection out at the source's size, audio kept
- **Anonymize** turns a 1–30 s selection into a **silhouette** video: tap each dancer (one, or a couple) on a frame and they are tracked through the clip. The result replaces the video in the pattern, with a *Silhouette* badge; the original stays in the gallery
- **Transcribe speech** writes down what the teacher says ([whisper.cpp](https://github.com/ggerganov/whisper.cpp) via `whisper.rn`, after a one-time ~61 MB model download). The transcript view shows timestamped lines: tap one to seek there, tick lines and **Add to description**. Shortening a video keeps only the transcript lines inside the cut
- **Suggest name and description** drafts both from the transcript and the list's vocabulary, using a small language model (Qwen3.5 2B via `llama.rn`, a one-time ~1.3 GB download, devices with ≥ 6 GB RAM). Nothing is written until you tap *Use suggestion*, which fills the name only when it is empty
- Downloaded models are hash-checked, listed under **Settings → On-device models** with their size, and can be deleted there

The native parts are local Expo modules in `modules/` (`video-anonymize`, `audio-extract`); on iOS and web these tools are hidden.

### Map
The **Map** tab shows the prerequisite graph in two switchable views:

| View | Description |
|---|---|
| **Timeline** | Swimlane layout — one lane per pattern type, patterns flow left-to-right by dependency depth; skip-level edges rendered as curved arcs with collision avoidance |
| **Network** | Force-free hierarchical graph with pan & pinch-zoom; nodes coloured by type and shaded by level |

Both views render from a single graph model, so they cannot disagree about depth, edges or cycles.

- Tap any node to open a **pattern details modal**
- **Search and filter the graph**, showing not just the matches but the chains they belong to — the path *to* a match, or everything connected to it. Matches stay bright and the context around them dims
- **Drag nodes in the network view** to arrange the graph by hand: long-press a node, then drag. The arrangement is saved per list, per device, and a pattern added later is seeded next to its prerequisites rather than triggering a re-layout
- Nodes **badge what they carry** — a play mark for video, dots for attached modifiers
- **Circular prerequisites are surfaced to the user** as a banner naming how many patterns are caught in a loop, not buried in a console warning
- Collapsible **legend** explaining type colours, level shading and the badges

### Reels
The **Reels** tab pages through every pattern that has a video, for browsing before a social rather than looking something up:

- An **overview** shows the patterns as stills, from the open list or from **every list** on the phone
- Tapping one opens them **one per screen**: swipe up and down between patterns, sideways through a pattern's videos (its own first, then those danced with a modifier)
- Only the video on screen holds a player, and leaving the tab stops it

### Filtering & Sorting
- Filter by **name** (substring), **type**, **level**, **exact counts**, and **tags**
- The same filter works on the **pattern list** and on the **graph**, where it additionally decides how much of a match's chain to draw
- Sort by name, type, level, counts, or id/date created (ascending / descending)
- Sorting by type, level or counts splits the list into **sections** with pinned headers and counts; types follow the list's own order, levels run beginner to advanced, and patterns without a value come last
- Both panels slide up as bottom sheets

### Import & Export
- Export selected pattern lists to a **JSON file** (format version `3.2.0`) shared via the native share sheet
- **Transcripts** travel only when you opt in on the export sheet, and never in a published cloud list
- Local videos — for patterns, universal modifiers and per-pattern modifier combinations — are **base64-embedded**, or left out entirely if you opt out (URL videos always survive)
- Option to **export as read-only** to prevent recipients from editing the list
- Import a previously exported file: lists that do not exist yet are added, and each conflicting list can be **skipped** or **replaced**
- Imported files are **validated before anything is written**. Damage that can be repaired (a dangling prerequisite, an unknown modifier position) is fixed and reported as a warning; damage that cannot (a missing list id, a duplicate pattern id, a version from a newer build) refuses the import rather than half-applying it
- Stored data carries a **schema version**, and migrations run once on start-up — forwards only, and idempotent

### Cloud Sharing
- **Publish** a list to the cloud — generates an 8-character **share code** and a **QR code**
- Other users can **subscribe** by entering the code or scanning the QR code; their copy stays live-synced via Firestore
- Subscribed copies are marked **read-only**; if the publisher stops sharing the list is detached and becomes fully editable
- **Only the publisher can update or stop sharing a list.** Publishing signs in to Firebase anonymously (no account, no personal data), and each list carries a secret **share key** that stays on the publisher's phone; an editable export carries it, so the publisher keeps control on a new phone or after a reinstall. Subscribing never signs in
- Requires optional Firebase configuration (see [Firebase Setup](#firebase-setup))

### Settings
- **Theme**: Light, Dark, or System default
- **Style**: *After Hours* (the default, made for dancers) or *Clipboard* (dense and structured, made for running a course), each in light and dark with its own typefaces
- **App icon**: the launcher icon in indigo (the default), amber or coral, independent of the style; offered where the platform supports alternate icons
- **Language**: nine locales — English, 中文, हिन्दी, Español, Français, العربية, বাংলা, Português, Deutsch. A fresh install follows the device language; your pick is remembered from then on
- **Data transfer**: export and import pattern lists
- **On-device models**: the speech and suggestion models, with their size and a *Delete* button (Android)

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

The Anonymize models (about 130 MB) are **not in git**. Fetch or export them into
`modules/video-anonymize/android/src/main/assets/` with the scripts in `scripts/` (see
[modules/AGENTS.md](modules/AGENTS.md)). `.easignore` lets EAS upload them although `.gitignore`
excludes them, and `npm run assets:check` runs as the `eas-build-pre-install` hook, so an Android
EAS build started from a checkout without them fails instead of shipping a build whose Anonymize
cannot work. Keep `.easignore` in step with `.gitignore`.

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

Build from a checkout that has the anonymize model weights (see `modules/AGENTS.md`), as for any
production build. To publish to another track later, change `track` (`internal`, `alpha`, `beta`,
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
