# Cloud sharing — `src/firebase/`

Optional Firestore-backed list sharing. The app runs local-only when credentials are absent.

`src/firebase/` provides optional Firestore-backed list sharing:
- `firebaseConfig.ts` — reads credentials from `Constants.expoConfig.extra.firebase`; when absent, `firebaseAvailable === false` and all service calls throw/no-op rather than crash the app. Also exports `db`, `APP_TOKEN` (write guard checked by Firestore Security Rules) and `SHARED_LISTS_COLLECTION = "sharedLists"`.
- `FirebaseListService.ts` — `publishList`, `syncPublishedList`, `unpublishList`, `fetchSharedList`, `subscribeToSharedList`; documents follow `SharedListDocument` (`list`, `patterns`, `publisherVersion`, `publishedAt`, `appToken`). Share codes are 8-char alphanumeric, generated with `expo-crypto` (CSPRNG).
- `useSharedList` (`src/pattern/data/hooks/useSharedList.ts`) — called inside `ActivePatternListProvider`; maintains a live `onSnapshot` listener while `activeList.shareCode` is set; handles publisher unpublishing (clears `shareCode`/`readonly` locally and surfaces a themed dialog).

**Publisher flow**: `ShareListModal` → `publishList()` → `IPatternList.shareCode` set → stored locally; the modal can render the code as a QR code (`react-native-qrcode-svg`).
**Subscriber flow**: `SubscribeListModal` → type the 8-char code or scan the QR with `QrCodeScanner` (`expo-camera`) → `fetchSharedList()` → list saved with `readonly: true` and `shareCode` → `useSharedList` keeps it in sync.

Writes are also pushed opportunistically from the UI: `PatternListManager` calls `syncPublishedList(activeList, patterns)` after pattern CRUD when a `shareCode` exists.


## Configuration

Config is **dynamic** — `app.config.ts` (there is no `app.json`) reads credentials from environment variables, so nothing secret is committed. Copy `.env.example` to `.env` (gitignored) and fill in:

```
FIREBASE_API_KEY, FIREBASE_AUTH_DOMAIN, FIREBASE_PROJECT_ID, FIREBASE_STORAGE_BUCKET,
FIREBASE_MESSAGING_SENDER_ID, FIREBASE_APP_ID, FIREBASE_MEASUREMENT_ID, FIREBASE_APP_TOKEN
```

Expo loads `.env` automatically for `expo start` / `eas build`; for EAS builds the same names must exist as EAS Secrets. Without them the app runs local-only.


A manual graph layout is **never** written to the shared document — see
`src/pattern/graph/AGENTS.md`. Under jest `firebaseAvailable` is always `false`; see
`__tests__/AGENTS.md`.
