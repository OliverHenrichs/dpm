# DPM (Dance Pattern Mapper)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Expo SDK](https://img.shields.io/badge/Expo-~57.0-blue?logo=expo)](https://expo.dev)
[![React Native](https://img.shields.io/badge/React%20Native-0.86-61dafb?logo=react)](https://reactnative.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178c6?logo=typescript)](https://www.typescriptlang.org)

> **Status:** Work in Progress 🚧

A React Native / Expo mobile app for mapping partner-dance patterns as a prerequisite graph.  
Organise patterns into dance-style-specific lists, visualise their dependencies in a swimlane timeline or a zoomable network graph, and share your lists with other dancers via export/import or live cloud sync.

---

## Features

### Pattern Lists
- Create pattern lists for any dance style — choose from **five built-in templates** (West Coast Swing, Salsa, Bachata, Argentine Tango, Lindy Hop) or start from a **blank list**
- Templates come with preset pattern types *and* a handful of foundational starter patterns
- Each list owns its own set of **custom pattern types** with individually assigned colours
- Edit list name and pattern types at any time (types with patterns cannot be removed)
- Delete lists individually; the active list persists across sessions

### Pattern Management
- Full **CRUD** for patterns within a list
- Per-pattern fields: name, type, counts, level (Beginner / Intermediate / Advanced), description, free-form **tags**, **prerequisite links** to other patterns, one or more **videos** (local file or URL with optional start time), and attached **modifiers**
- Supports **online videos** including YouTube links with in-app playback
- Inline video thumbnails with a swipeable carousel in both the edit form and the detail view

### Modifiers
Modifiers are affixes that change how a pattern is danced ("with a spin", "slow", "hijacked"). They are defined per list, on their own tab next to the patterns:

- Each modifier has a **position** — *prefix* (precedes), *postfix* (follows) or *amends* (modifies within)
- **Universal** modifiers apply to every pattern in the list and carry their own demo videos
- **Non-universal** modifiers are attached to individual patterns, and each attachment can hold videos of *that* pattern danced with *that* modifier
- A modifier's detail view lists every pattern it is attached to; deleting a modifier detaches it from all patterns

### Graph Visualisation
Two switchable views driven by the prerequisite graph:

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

### Filtering & Sorting
- Filter by **name** (substring), **type**, **level**, **exact counts**, and **tags**
- The same filter works on the **pattern list** and on the **graph**, where it additionally decides how much of a match's chain to draw
- Sort by name, type, level, counts, or id/date created (ascending / descending)
- Both panels slide up as bottom sheets

### Import & Export
- Export selected pattern lists to a **JSON file** (format version `3.0.0`) shared via the native share sheet
- Local videos — for patterns, universal modifiers and per-pattern modifier combinations — are **base64-embedded**, or left out entirely if you opt out (URL videos always survive)
- Option to **export as read-only** to prevent recipients from editing the list
- Import a previously exported file: lists that do not exist yet are added, and each conflicting list can be **skipped** or **replaced**
- Imported files are **validated before anything is written**. Damage that can be repaired (a dangling prerequisite, an unknown modifier position) is fixed and reported as a warning; damage that cannot (a missing list id, a duplicate pattern id, a version from a newer build) refuses the import rather than half-applying it
- Stored data carries a **schema version**, and migrations run once on start-up — forwards only, and idempotent

### Cloud Sharing
- **Publish** a list to the cloud — generates an 8-character **share code** and a **QR code**
- Other users can **subscribe** by entering the code or scanning the QR code; their copy stays live-synced via Firestore
- Subscribed copies are marked **read-only**; if the publisher stops sharing the list is detached and becomes fully editable
- Requires optional Firebase configuration (see [Firebase Setup](#firebase-setup))

### Settings
- **Theme**: Light, Dark, or System default
- **Language**: nine locales — English, 中文, हिन्दी, Español, Français, العربية, বাংলা, Português, Deutsch
- **Data transfer**: export and import pattern lists

---

## Tech Stack

| Layer | Library / Version |
|---|---|
| Framework | [Expo](https://expo.dev) ~57 / React Native 0.86 / React 19 |
| Navigation | [Expo Router](https://expo.github.io/router) file-based routing + its built-in `Drawer` layout |
| Persistence | [@react-native-async-storage/async-storage](https://github.com/react-native-async-storage/async-storage) |
| Cloud sync | [Firebase](https://firebase.google.com) (Firestore) ^12 |
| Graphics | [react-native-svg](https://github.com/software-mansion/react-native-svg) 15 |
| Gestures & animation | [react-native-gesture-handler](https://docs.swmansion.com/react-native-gesture-handler) + [react-native-reanimated](https://docs.swmansion.com/react-native-reanimated) — pan, pinch and node dragging all run on the UI thread |
| Video | [expo-video](https://docs.expo.dev/versions/latest/sdk/video) + [expo-video-thumbnails](https://docs.expo.dev/versions/latest/sdk/video-thumbnails) |
| YouTube | [react-native-youtube-iframe](https://lonelycpp.github.io/react-native-youtube-iframe) |
| QR codes | [react-native-qrcode-svg](https://github.com/awesomejerry/react-native-qrcode-svg) + [expo-camera](https://docs.expo.dev/versions/latest/sdk/camera) |
| File / Share | [expo-file-system](https://docs.expo.dev/versions/latest/sdk/filesystem) + [expo-sharing](https://docs.expo.dev/versions/latest/sdk/sharing) + [expo-document-picker](https://docs.expo.dev/versions/latest/sdk/document-picker) |
| i18n | [i18next](https://www.i18next.com) + [react-i18next](https://react.i18next.com) |
| Language | TypeScript ~6.0 |
| Testing | Jest 30 + ts-jest + @testing-library/react-native — **901 tests** across two projects |

The new architecture, typed routes and the React Compiler are enabled in `app.config.ts`.

---

## Project Structure

```
app/                     Expo Router routes: _layout (drawer) + one file per screen
locales/                 one <code>.json translation resource per language
src/common/              Theme, palette, drawer menu, shared components (dialogs, bottom sheet, video)
src/i18n.ts              i18next bootstrap, imported by the root layout
src/pattern/types/       IPatternList, IPattern, IModifier, PatternType, PatternLevel
src/pattern/data/        AsyncStorage layer, export/import, id allocation, templates
  ├─ validation/         Runtime validation of imported files
  └─ migrations/         Versioned, forward-only schema migrations
src/pattern/list/        List & modifier screens, edit forms, share/subscribe modals
src/pattern/filter/      Filter bottom sheet, its sub-panels and the shared filter hook
src/pattern/graph/       Timeline + network views, details modal
  ├─ model/              Pure graph maths: adjacency, cycles, depth, filtering, layout merge
  ├─ render/             Shared SVG primitives and the drag overlay
  └─ data/               Per-list manual layout storage
src/firebase/            Optional Firestore config and list-sharing service
src/settings/            Settings screen and data-transfer hook
__mocks__/               Behavioural mocks: AsyncStorage, filesystem, Reanimated, gestures
__tests__/ , utils/      Jest tests and test factories
```

See [AGENTS.md](AGENTS.md) for a deeper architecture walkthrough and the project's conventions.

---

## Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Start the dev server (LAN mode)
npm start                 # → expo start --lan

# Or target a specific platform
npm run android
npm run ios
npx expo start --web
```

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
