import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getFirestore, Firestore } from "firebase/firestore";
import Constants from "expo-constants";

/**
 * Firebase configuration comes from `extra.firebase` in app.config.ts, which
 * reads the FIREBASE_* environment variables (.env locally, EAS environment
 * variables for builds; see .env.example). When they are absent the app runs
 * in local-only mode and all Firebase service calls are no-ops rather than
 * crashes.
 *
 * NOTE: Firebase API keys are NOT secret — they only identify the project.
 * Access is controlled by the Firestore Security Rules in firestore.rules.
 */
const cfg = Constants.expoConfig?.extra?.firebase as
  Record<string, string> | undefined;

export const firebaseAvailable = !!(cfg?.apiKey && cfg?.projectId);

let _app: FirebaseApp | undefined;
let _db: Firestore | undefined;

if (firebaseAvailable && cfg) {
  _app = getApps().length ? getApps()[0] : initializeApp(cfg);
  _db = getFirestore(_app);
}

/** Firebase app — undefined when Firebase is not configured. */
export const app: FirebaseApp | undefined = _app;

/** Firestore instance — undefined when Firebase is not configured. */
export const db: Firestore | undefined = _db;

/** Write-guard token checked by Firestore Security Rules. */
export const APP_TOKEN: string =
  (Constants.expoConfig?.extra?.firebaseAppToken as string | undefined) ?? "";

/** Firestore collection that holds all shared lists. */
export const SHARED_LISTS_COLLECTION = "sharedLists";

/**
 * Firestore collection of owner records, one per shared list under the same
 * share code: `{ ownerUid, key }`. Nobody can read it; the security rules use
 * it to let only the publisher update or delete a list.
 */
export const SHARED_LIST_OWNERS_COLLECTION = "sharedListOwners";
