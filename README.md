# DPM (Dance Pattern Mapper)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Expo SDK](https://img.shields.io/badge/Expo-~54.0-blue?logo=expo)](https://expo.dev)
[![React Native](https://img.shields.io/badge/React%20Native-0.81-61dafb?logo=react)](https://reactnative.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6?logo=typescript)](https://www.typescriptlang.org)

> **Status:** Work in Progress 🚧

A React Native / Expo mobile app for mapping partner-dance patterns as a prerequisite graph.  
Organise patterns into dance-style-specific lists, visualise their dependencies in a swimlane timeline or a zoomable network graph, and share your lists with other dancers via export/import or live cloud sync.

---

## Features

### Pattern Lists
- Create pattern lists for any dance style — choose from **six built-in templates** (West Coast Swing, Salsa, Bachata, Argentine Tango, Lindy Hop) or start from a **blank list**
- Each list owns its own set of **custom pattern types** with individually assigned colours
- Edit list name and pattern types at any time (types with patterns cannot be removed)
- Delete lists individually; the active list persists across sessions

### Pattern Management
- Full **CRUD** for patterns within a list
- Per-pattern fields: name, type, counts, level (Beginner / Intermediate / Advanced), description, free-form **tags**, **prerequisite links** to other patterns, and one or more **videos** (local file or URL with optional start time)
- Supports **online videos** including YouTube links with in-app playback
- Inline video thumbnails with a swipeable carousel in both the edit form and the detail view

### Graph Visualisation
Two switchable views driven by the prerequisite graph:

| View | Description |
|---|---|
| **Timeline** | Swimlane layout — one lane per pattern type, patterns flow left-to-right by dependency depth; skip-level edges rendered as curved arcs |
| **Network** | Force-free hierarchical graph with pan & pinch-zoom; nodes coloured by type and shaded by level |

- Tap any node to open a **pattern details modal**
- Collapsible **legend** showing type colours and level shading
- Circular-dependency detection with a warning overlay

### Filtering & Sorting
- Filter by **name** (substring), **type**, **level**, **exact counts**, and **tags**
- Sort by name, type, level, counts, or date created (ascending / descending)
- Both panels slide up as bottom sheets

### Import & Export
- Export selected pattern lists to a **JSON file** with optional base64-embedded local videos, shared via the native share sheet
- Option to **export as read-only** to prevent recipients from editing the list
- Import a previously exported file: conflict resolution per list (**skip**, **replace**, or import as **new list**)

### Cloud Sharing
- **Publish** a list to the cloud — generates an 8-character **share code** and a **QR code**
- Other users can **subscribe** by entering the code or scanning the QR code; their copy stays live-synced via Firestore
- Subscribed copies are marked **read-only**; if the publisher stops sharing the list is detached and becomes fully editable
- Requires optional Firebase configuration (see [Firebase Setup](#firebase-setup))

### Settings
- **Theme**: Light, Dark, or System default
- **Language**: English 🇬🇧 and German 🇩🇪

---

## Tech Stack

| Layer | Library / Version |
|---|---|
| Framework | [Expo](https://expo.dev) ~54 / React Native 0.81 |
| Navigation | [Expo Router](https://expo.github.io/router) + [React Navigation Drawer](https://reactnavigation.org) |
| Persistence | [@react-native-async-storage/async-storage](https://github.com/react-native-async-storage/async-storage) |
| Cloud sync | [Firebase](https://firebase.google.com) (Firestore) ^12 |
| Graphics | [react-native-svg](https://github.com/software-mansion/react-native-svg) 15 |
| Pan & zoom | [@openspacelabs/react-native-zoomable-view](https://github.com/openspacelabs/react-native-zoomable-view) |
| Video | [expo-video](https://docs.expo.dev/versions/latest/sdk/video) + [expo-video-thumbnails](https://docs.expo.dev/versions/latest/sdk/video-thumbnails) |
| YouTube | [react-native-youtube-iframe](https://lonelycpp.github.io/react-native-youtube-iframe) |
| QR codes | [react-native-qrcode-svg](https://github.com/awesomejerry/react-native-qrcode-svg) + [expo-camera](https://docs.expo.dev/versions/latest/sdk/camera) |
| File / Share | [expo-file-system](https://docs.expo.dev/versions/latest/sdk/filesystem) + [expo-sharing](https://docs.expo.dev/versions/latest/sdk/sharing) + [expo-document-picker](https://docs.expo.dev/versions/latest/sdk/document-picker) |
| i18n | [i18next](https://www.i18next.com) + [react-i18next](https://react.i18next.com) |
| Language | TypeScript 5.9 |
| Testing | Jest 29 + ts-jest + @testing-library/react-native |

---

## Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Start the dev server (LAN mode)
npx expo start

# Or target a specific platform
npx expo start --android
npx expo start --ios
npx expo start --web
```

### Running Tests

```bash
npm test                  # run all tests
npm run test:watch        # watch mode
npm run test:coverage     # generate coverage report
```

### Firebase Setup

Cloud sharing is **optional**. Without Firebase credentials the app runs fully offline and all sharing UI is hidden.

To enable it, create a `.env` file in the project root (see `.env.example`) with your Firebase project credentials:

```dotenv
FIREBASE_API_KEY=...
FIREBASE_AUTH_DOMAIN=...
FIREBASE_PROJECT_ID=...
FIREBASE_STORAGE_BUCKET=...
FIREBASE_MESSAGING_SENDER_ID=...
FIREBASE_APP_ID=...
FIREBASE_APP_TOKEN=...   # write token used by the publish flow
```

Expo loads `.env` automatically when running `expo start` or `eas build`.  
For EAS cloud builds, add each variable as an [EAS Secret](https://docs.expo.dev/build-reference/variables/#using-secrets-in-eas-build).
