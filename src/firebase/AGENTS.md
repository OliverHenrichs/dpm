# Cloud sharing — `src/firebase/`

Optional Firestore-backed list sharing. The app runs local-only when credentials are absent.

`src/firebase/` provides optional Firestore-backed list sharing:

- `firebaseConfig.ts` — reads credentials from `Constants.expoConfig.extra.firebase`; when absent, `firebaseAvailable === false` and all service calls throw/no-op rather than crash the app. Also exports `app`, `db`, `APP_TOKEN` (write guard checked by Firestore Security Rules), `SHARED_LISTS_COLLECTION = "sharedLists"` and `SHARED_LIST_OWNERS_COLLECTION = "sharedListOwners"`.
- `FirebaseListService.ts` — `publishList`, `syncPublishedList`, `unpublishList`, `fetchSharedList`, `subscribeToSharedList`; documents follow `SharedListDocument` (`list`, `patterns`, `publisherVersion`, `publishedAt`, `appToken`). Share codes are 8-char alphanumeric, generated with `expo-crypto` (CSPRNG). `publishList` returns `{ shareCode, shareKey }` and `unpublishList` takes the list.
- `auth.ts` / `auth.web.ts` — `ensureSignedIn()`: anonymous Firebase Auth, created lazily on the first publish (subscribing never signs in), persisted in AsyncStorage on native. A platform split because only the react-native build of `firebase/auth` has `getReactNativePersistence` (typed in `firebaseAuthReactNative.d.ts`).
- `shareKey.ts` — `generateShareKey()`, the publisher's 256-bit secret for one list.
- `useSharedList` (`src/pattern/data/hooks/useSharedList.ts`) — called inside `ActivePatternListProvider`; maintains a live `onSnapshot` listener while `activeList.shareCode` is set; handles publisher unpublishing (clears `shareCode`/`readonly` locally and surfaces a themed dialog).

**Publisher flow**: `ShareListModal` → `publishList()` → `IPatternList.shareCode` set → stored locally; the modal can render the code as a QR code (`react-native-qrcode-svg`).
**Subscriber flow**: `SubscribeListModal` → type the 8-char code or scan the QR with `QrCodeScanner` (`expo-camera`) → `fetchSharedList()` → list saved with `readonly: true` and `shareCode` → `useSharedList` keeps it in sync.

Writes are also pushed opportunistically from the UI: `PatternListManager` calls `syncPublishedList(activeList, patterns)` after pattern CRUD when a `shareCode` exists.

## Ownership and security rules

Subscribers only read, without signing in. A publisher signs in anonymously, and each published
list has an **owner record** in `sharedListOwners/{shareCode}`: `{ ownerUid, key }`, readable by
nobody. Only the owner on record may update or delete the list. `key` is the list's **share key**
(`IPatternList.shareKey`), and presenting it moves ownership to the caller — that is how the
publisher keeps control after a reinstall (new anonymous id) or on a new phone.

- **Every publish writes the owner record and the list in one batch**, so the first publish
  creates the record and every sync re-confirms it (a no-op, or a takeover with the key). The
  rules check the list's owner with `getAfter`. `unpublishList` first writes the record (taking
  over if needed), then deletes list and record in one batch: a delete carries no data to check.
- **The share key lives on the publisher's list and nowhere public.** `savePatternList` keeps it
  present exactly when the list has a `shareCode` and is not `readonly`, keeps the stored key when
  a caller passes an older copy without it (a fresh key would lock the device out), and mints one
  for lists published before keys existed (migration 002 does that for every list up front).
  `publishList` strips it from the published document and the rules refuse a document carrying
  it. Editable exports carry it, read-only exports do not (`src/pattern/data/AGENTS.md`).
- **Lists published before owner records** have none; the first signed-in publish claims them.
  In the app only the publisher's phone makes that write, but a subscriber working outside the
  app could claim one first. The rules allow such a claim only until 1 April 2027.
- **Anonymous sign-in must be enabled** in the Firebase console (Authentication → Sign-in
  method), and the API key, if restricted, must allow the Identity Toolkit API. Without either,
  publishing fails with an auth error.
- **Deploy order.** Builds without this code cannot publish under these rules (they do not sign
  in). Deploy the rules once builds that sign in are what people run.

`firestore.rules` at the repository root is the deployed rule set, wired up by `firebase.json`.
Change it together with `FirebaseListService`: the rules accept exactly the document
`publishList()` writes (the five `SharedListDocument` keys, stored under its own 8-character
code, no `readonly` or `shareKey` on the stored list), allow `get` by code but never `list`, and
deny everything outside the two collections.

- **The app token is compared by its SHA-256.** The repository is public, so it holds the hash,
  not `FIREBASE_APP_TOKEN`. Rotating the token means new values in `.env` and every EAS
  environment, a rebuild, and a new hash in the rules; builds carrying the old token can no
  longer publish. The token is readable in the APK and in every published document, so it
  stops drive-by writes, not a determined one; ownership is what protects a list.
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
