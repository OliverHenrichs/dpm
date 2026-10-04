# Cloud sharing — `src/firebase/`

Optional Firestore-backed list sharing. The app runs local-only when credentials are absent.

`src/firebase/` provides optional Firestore-backed list sharing:

- `firebaseConfig.ts` — reads credentials from `Constants.expoConfig.extra.firebase`; when absent, `firebaseAvailable === false` and all service calls throw/no-op rather than crash the app. Also exports `db`, `APP_TOKEN` (write guard checked by Firestore Security Rules) and `SHARED_LISTS_COLLECTION = "sharedLists"`.
- `FirebaseListService.ts` — `publishList`, `syncPublishedList`, `unpublishList`, `fetchSharedList`, `subscribeToSharedList`; documents follow `SharedListDocument` (`list`, `patterns`, `publisherVersion`, `publishedAt`, `appToken`). Share codes are 8-char alphanumeric, generated with `expo-crypto` (CSPRNG).
- `useSharedList` (`src/pattern/data/hooks/useSharedList.ts`) — called inside `ActivePatternListProvider`; maintains a live `onSnapshot` listener while `activeList.shareCode` is set; handles publisher unpublishing (clears `shareCode`/`readonly` locally and surfaces a themed dialog).

**Publisher flow**: `ShareListModal` → `publishList()` → `IPatternList.shareCode` set → stored locally; the modal can render the code as a QR code (`react-native-qrcode-svg`).
**Subscriber flow**: `SubscribeListModal` → type the 8-char code or scan the QR with `QrCodeScanner` (`expo-camera`) → `fetchSharedList()` → list saved with `readonly: true` and `shareCode` → `useSharedList` keeps it in sync.

Writes are also pushed opportunistically from the UI: `PatternListManager` calls `syncPublishedList(activeList, patterns)` after pattern CRUD when a `shareCode` exists.

## Security rules

`firestore.rules` at the repository root is the deployed rule set, wired up by `firebase.json`.
Change it together with `FirebaseListService`: the rules accept exactly the document
`publishList()` writes (the five `SharedListDocument` keys, stored under its own 8-character
code, no `readonly` on the stored list), allow `get` by code but never `list`, allow a bare
delete by code, and deny everything outside `sharedLists`.

- **The app token is compared by its SHA-256.** The repository is public, so it holds the hash,
  not `FIREBASE_APP_TOKEN`. Rotating the token means new values in `.env` and every EAS
  environment, a rebuild, and a new hash in the rules; builds carrying the old token can no
  longer publish. The token is readable in the APK and in every published document, so it
  stops drive-by writes, not a determined one.
- **No sign-in, so no owner.** Anyone with a code can read, re-publish over, or delete that
  list. Closing that needs Firebase Auth (anonymous sign-in, an owner uid on the document).
- **Tests** (`__tests__/rules/`, `npm run test:rules`) run the real file in the Firestore
  emulator with the hash swapped for a test token's. They need Java 21+, so they are not part of
  `npm test`; CI runs them in their own job.
- **Deploying** is `npm run rules:deploy` (`firebase login` once; the project id comes from
  `.env`). It changes production for every installed app: run the rules tests first.

## Configuration

Config is **dynamic** — `app.config.ts` (there is no `app.json`) reads credentials from environment variables, so nothing secret is committed. Copy `.env.example` to `.env` (gitignored) and fill in:

```
FIREBASE_API_KEY, FIREBASE_AUTH_DOMAIN, FIREBASE_PROJECT_ID, FIREBASE_STORAGE_BUCKET,
FIREBASE_MESSAGING_SENDER_ID, FIREBASE_APP_ID, FIREBASE_MEASUREMENT_ID, FIREBASE_APP_TOKEN
```

Expo loads `.env` automatically for `expo start` / `eas build`; for EAS builds the same names must exist as EAS environment variables (they are set in `production`, `preview` and `development`). Without them the app runs local-only.

A manual graph layout is **never** written to the shared document — see
`src/pattern/graph/AGENTS.md`. Under jest `firebaseAvailable` is always `false`; see
`__tests__/AGENTS.md`.
