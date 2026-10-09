import {
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  Unsubscribe,
  writeBatch,
} from "firebase/firestore";
import {
  APP_TOKEN,
  db,
  firebaseAvailable,
  SHARED_LIST_OWNERS_COLLECTION,
  SHARED_LISTS_COLLECTION,
} from "@/src/firebase/firebaseConfig";
import { ensureSignedIn } from "@/src/firebase/auth";
import { generateShareKey } from "@/src/firebase/shareKey";
import {
  publishedModifiers,
  publishedPattern,
} from "@/src/firebase/publishedContent";
import { getPatternListById } from "@/src/pattern/data/PatternListStorage";
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

/** `sharedListOwners/{shareCode}` — readable by nobody, checked by the rules. */
export interface SharedListOwnerDocument {
  ownerUid: string; // the publisher's anonymous Firebase Auth id
  key: string; // the list's share key; proves the right to take it over
}

export interface PublishedList {
  shareCode: string;
  shareKey: string;
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
      "Firebase is not configured. Set the FIREBASE_* variables (see .env.example).",
    );
  }
  return db;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * The share key for a published list. An in-memory copy of the list can be
 * older than what storage holds (the key is added on save), so storage is
 * asked when the copy has none.
 */
async function resolveShareKey(list: IPatternList): Promise<string> {
  const key =
    list.shareKey ?? (await getPatternListById(list.id))?.shareKey ?? undefined;
  if (!key) throw new Error("Cannot sync: list has no share key.");
  return key;
}

/** The owner record naming `uid` as the list's owner. */
function ownerRecord(uid: string, shareKey: string): SharedListOwnerDocument {
  return { ownerUid: uid, key: shareKey };
}

/**
 * Publish (or re-publish / sync) a list to Firestore.
 * The stored copy always has readonly:true so importers cannot accidentally
 * edit it. Returns the share code that others use to subscribe, and the share
 * key, which the caller stores on the list.
 *
 * Every publish also writes the owner record, in the same batch. The first
 * time that creates it; afterwards the rules accept it only with the same key,
 * so it either changes nothing or moves ownership to this device's anonymous
 * id — after a reinstall, or on a new phone given an editable export.
 */
export async function publishList(
  list: IPatternList,
  patterns: IPattern[],
): Promise<PublishedList> {
  const firestore = requireDb();
  const shareCode = list.shareCode ?? generateShareCode();
  const shareKey = list.shareCode
    ? await resolveShareKey(list)
    : generateShareKey();
  const uid = await ensureSignedIn();

  // Destructure out readonly, shareCode and shareKey so we rebuild them
  // cleanly. Firestore rejects undefined values, so omitting a field entirely
  // is safer than setting it to undefined. The share key must never reach
  // the published document: subscribers can read that.
  const {
    readonly: _readonly,
    shareCode: _prevCode,
    shareKey: _shareKey,
    ...listBase
  } = list;

  const payload: SharedListDocument = {
    list: {
      ...listBase,
      modifiers: publishedModifiers(listBase.modifiers ?? []),
      shareCode,
    },
    // Local videos and their transcripts stay on the device (L4): subscribers
    // get the patterns and their URL videos, not files on the publisher's phone
    // or what a teacher said while demonstrating them.
    patterns: patterns.map(publishedPattern),
    publisherVersion: Date.now(),
    publishedAt: new Date().toISOString(),
    appToken: APP_TOKEN,
  };

  const batch = writeBatch(firestore);
  batch.set(
    doc(firestore, SHARED_LIST_OWNERS_COLLECTION, shareCode),
    ownerRecord(uid, shareKey),
  );
  batch.set(doc(firestore, SHARED_LISTS_COLLECTION, shareCode), payload);
  await batch.commit();
  return { shareCode, shareKey };
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
 * Remove a published list and its owner record from Firestore.
 * After this call, subscribers will receive a "list no longer exists" error.
 *
 * Ownership is confirmed (or taken over with the key) first: a delete carries
 * no data, so the rules can only compare the caller with the owner on record.
 */
export async function unpublishList(list: IPatternList): Promise<void> {
  const firestore = requireDb();
  if (!list.shareCode) {
    throw new Error("Cannot unpublish: list has no shareCode.");
  }
  const shareKey = await resolveShareKey(list);
  const uid = await ensureSignedIn();
  const ownerRef = doc(
    firestore,
    SHARED_LIST_OWNERS_COLLECTION,
    list.shareCode,
  );

  await setDoc(ownerRef, ownerRecord(uid, shareKey));
  const batch = writeBatch(firestore);
  batch.delete(doc(firestore, SHARED_LISTS_COLLECTION, list.shareCode));
  batch.delete(ownerRef);
  await batch.commit();
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
