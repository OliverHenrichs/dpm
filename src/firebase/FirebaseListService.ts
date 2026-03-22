import {
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  Unsubscribe,
} from "firebase/firestore";
import {
  APP_TOKEN,
  db,
  firebaseAvailable,
  SHARED_LISTS_COLLECTION,
} from "@/src/firebase/firebaseConfig";
import { IPattern, IPatternList } from "@/src/pattern/types/IPatternList";
import { PatternListWithPatterns } from "@/src/pattern/data/types/IExportData";
import * as Crypto from "expo-crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SharedListDocument {
  list: IPatternList;
  patterns: IPattern[];
  publisherVersion: number; // epoch ms — lets subscribers detect staleness
  publishedAt: string; // ISO date string
  appToken: string; // checked by Firestore Security Rules
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Generate a cryptographically secure 8-character alphanumeric share code.
 * Uses expo-crypto (CSPRNG) instead of Math.random() to ensure sufficient
 * entropy, as required by GDPR Art. 32 (security of processing).
 */
function generateShareCode(): string {
  const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const bytes = Crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

function requireDb(): NonNullable<typeof db> {
  if (!firebaseAvailable || !db) {
    throw new Error(
      "Firebase is not configured. Add firebase credentials to app.json extra.",
    );
  }
  return db;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Publish (or re-publish / sync) a list to Firestore.
 * The stored copy always has readonly:true so importers cannot accidentally
 * edit it. Returns the share code that others use to subscribe.
 */
export async function publishList(
  list: IPatternList,
  patterns: IPattern[],
): Promise<string> {
  const firestore = requireDb();
  const shareCode = list.shareCode ?? generateShareCode();

  // Destructure out readonly and shareCode so we rebuild them cleanly.
  // Firestore rejects undefined values, so omitting the field entirely is
  // safer than setting readonly: undefined.
  const { readonly: _readonly, shareCode: _prevCode, ...listBase } = list;

  const payload: SharedListDocument = {
    list: { ...listBase, shareCode },
    patterns,
    publisherVersion: Date.now(),
    publishedAt: new Date().toISOString(),
    appToken: APP_TOKEN,
  };

  await setDoc(doc(firestore, SHARED_LISTS_COLLECTION, shareCode), payload);
  return shareCode;
}

/**
 * Push an updated list to the existing Firestore document.
 * Requires list.shareCode to already be set.
 */
export async function syncPublishedList(
  list: IPatternList,
  patterns: IPattern[],
): Promise<void> {
  if (!list.shareCode) {
    throw new Error("Cannot sync: list has no shareCode.");
  }
  await publishList(list, patterns);
}

/**
 * Remove a published list from Firestore.
 * After this call, subscribers will receive a "list no longer exists" error.
 */
export async function unpublishList(shareCode: string): Promise<void> {
  const firestore = requireDb();
  await deleteDoc(doc(firestore, SHARED_LISTS_COLLECTION, shareCode));
}

/**
 * Fetch a shared list once by share code.
 * Returns null when the code does not exist.
 */
export async function fetchSharedList(
  shareCode: string,
): Promise<PatternListWithPatterns | null> {
  const firestore = requireDb();
  const snap = await getDoc(
    doc(firestore, SHARED_LISTS_COLLECTION, shareCode.toUpperCase()),
  );
  if (!snap.exists()) return null;
  const data = snap.data() as SharedListDocument;
  return { ...data.list, patterns: data.patterns };
}

/**
 * Subscribe to live updates for a shared list.
 * @param shareCode   - The 8-character code shared by the publisher.
 * @param onUpdate    - Called with a fresh PatternListWithPatterns whenever the publisher pushes changes.
 * @param onError     - Called when the document disappears or a network error occurs.
 * @returns           An unsubscribe function — call it when the subscriber navigates away.
 */
export function subscribeToSharedList(
  shareCode: string,
  onUpdate: (list: PatternListWithPatterns) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  if (!firebaseAvailable || !db) {
    onError(new Error("Firebase is not configured."));
    return () => {};
  }

  return onSnapshot(
    doc(db, SHARED_LISTS_COLLECTION, shareCode.toUpperCase()),
    (snap) => {
      if (!snap.exists()) {
        onError(new Error("Shared list no longer exists."));
        return;
      }
      const data = snap.data() as SharedListDocument;
      onUpdate({ ...data.list, patterns: data.patterns });
    },
    (err) => onError(new Error(err.message)),
  );
}
