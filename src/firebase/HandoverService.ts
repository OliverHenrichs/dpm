import {
  collection,
  deleteDoc,
  doc,
  Firestore,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  Timestamp,
  Unsubscribe,
  where,
  writeBatch,
} from "firebase/firestore";
import * as Crypto from "expo-crypto";
import {
  db,
  firebaseAvailable,
  HANDOVERS,
  SHARED_LIST_OWNERS_COLLECTION,
  SHARED_LISTS_COLLECTION,
  SUBSCRIBERS,
} from "@/src/firebase/firebaseConfig";
import { ensureSignedIn, restoreSignIn } from "@/src/firebase/auth";
import { generateShareKey } from "@/src/firebase/shareKey";
import {
  asOwner,
  isPermissionDenied,
} from "@/src/firebase/PatternSuggestionService";
import { IPatternList } from "@/src/pattern/types/IPatternList";

/**
 * Handing a published list over to someone who follows it (`src/pattern/handover/AGENTS.md`).
 *
 * The owner makes a one-time offer, `sharedLists/{code}/handovers/{handoverCode}`, and passes the
 * code on. The new owner's phone accepts it and, in the same write, becomes the owner on record
 * with a fresh share key, which locks the old key out. The share code stays, so every subscriber
 * keeps following. The old owner's phone sees the accepted offer and turns its copy into a
 * subscribed one. See `firestore.rules`.
 */

/** How long an offer can be accepted; the rules hold the same limit. */
export const HANDOVER_DAYS = 7;
export const HANDOVER_CODE_LENGTH = 10;

/** `sharedLists/{code}/handovers/{handoverCode}` as stored. */
export interface HandoverDocument {
  fromUid: string;
  offeredAt: Timestamp;
  acceptedBy?: string;
  acceptedAt?: Timestamp;
}

/** An offer this phone made that nobody has accepted yet. */
export interface OpenHandover {
  code: string;
  /** Epoch milliseconds after which it can no longer be accepted. */
  expiresAt: number;
}

/** The code was wrong, used, withdrawn or too old; the rules do not say which. */
export class HandoverRefusedError extends Error {
  constructor() {
    super("The handover code was refused.");
    this.name = "HandoverRefusedError";
  }
}

/** A 10-character code, 0-9 and A-Z, like a share code but longer: it hands over control. */
function generateHandoverCode(): string {
  const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const bytes = Crypto.getRandomValues(new Uint8Array(HANDOVER_CODE_LENGTH));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

function requireDb(): Firestore {
  if (!firebaseAvailable || !db) {
    throw new Error("Firebase is not configured.");
  }
  return db;
}

function requireCode(list: IPatternList): string {
  if (!list.shareCode) throw new Error("The list is not published.");
  return list.shareCode;
}

function handovers(firestore: Firestore, code: string) {
  return collection(doc(firestore, SHARED_LISTS_COLLECTION, code), HANDOVERS);
}

function expiresAt(data: HandoverDocument): number {
  // A pending server timestamp reads as null: the offer was made just now.
  const offered = data.offeredAt?.toMillis?.() ?? Date.now();
  return offered + HANDOVER_DAYS * 86400000;
}

/** This phone's own offers for a list, as the owner on record. */
async function ownOffers(list: IPatternList) {
  const firestore = requireDb();
  const code = requireCode(list);
  const uid = await ensureSignedIn();
  return asOwner(list, () =>
    getDocs(query(handovers(firestore, code), where("fromUid", "==", uid))),
  );
}

// ---------------------------------------------------------------------------
// The owner
// ---------------------------------------------------------------------------

/**
 * Offer the list to whoever enters the returned code within `HANDOVER_DAYS`. Earlier offers from
 * this phone are withdrawn: one code at a time. On a members-only list the owner lets themselves
 * in first, so their phone can still follow the list once it belongs to someone else.
 */
export async function offerHandover(list: IPatternList): Promise<string> {
  const firestore = requireDb();
  const code = requireCode(list);
  const uid = await ensureSignedIn();
  const previous = await ownOffers(list);
  const handoverCode = generateHandoverCode();
  await asOwner(list, async () => {
    const batch = writeBatch(firestore);
    previous.docs.forEach((d) => batch.delete(d.ref));
    if (list.membersOnly) {
      batch.set(
        doc(
          collection(
            doc(firestore, SHARED_LISTS_COLLECTION, code),
            SUBSCRIBERS,
          ),
          uid,
        ),
        { membership: "member", updatedAt: serverTimestamp() },
        { merge: true },
      );
    }
    batch.set(doc(handovers(firestore, code), handoverCode), {
      fromUid: uid,
      offeredAt: serverTimestamp(),
    });
    await batch.commit();
  });
  return handoverCode;
}

/** The offer this phone made for the list that is still open, if any. */
export async function getOpenHandover(
  list: IPatternList,
): Promise<OpenHandover | null> {
  const snap = await ownOffers(list);
  const open = snap.docs
    .map((d) => ({ code: d.id, data: d.data() as HandoverDocument }))
    .filter(({ data }) => !data.acceptedBy && expiresAt(data) > Date.now())
    .map(({ code, data }) => ({ code, expiresAt: expiresAt(data) }));
  return open[0] ?? null;
}

/** Withdraw an offer: its code stops working. */
export async function withdrawHandover(
  list: IPatternList,
  handoverCode: string,
): Promise<void> {
  const firestore = requireDb();
  const code = requireCode(list);
  await asOwner(list, () =>
    deleteDoc(doc(handovers(firestore, code), handoverCode)),
  );
}

/**
 * Watch this phone's offers for a list it publishes, and report the code of one someone else has
 * accepted. Never signs in: a phone without an id has made no offers.
 */
export function subscribeToAcceptedHandover(
  shareCode: string,
  onAccepted: (handoverCode: string) => void,
): Unsubscribe {
  if (!firebaseAvailable || !db) return () => {};
  const firestore = db;
  let unsubscribe: Unsubscribe | null = null;
  let stopped = false;
  restoreSignIn().then(
    (uid) => {
      if (stopped || !uid) return;
      unsubscribe = onSnapshot(
        query(handovers(firestore, shareCode), where("fromUid", "==", uid)),
        (snap) => {
          const accepted = snap.docs.find((d) => {
            const by = (d.data() as HandoverDocument).acceptedBy;
            return !!by && by !== uid;
          });
          if (accepted) onAccepted(accepted.id);
        },
        (err) => console.warn("Handover: listening failed", err.message),
      );
    },
    () => undefined,
  );
  return () => {
    stopped = true;
    unsubscribe?.();
  };
}

/** Remove an accepted offer once the old owner's phone has followed it. */
export async function clearAcceptedHandover(
  shareCode: string,
  handoverCode: string,
): Promise<void> {
  const firestore = requireDb();
  await deleteDoc(doc(handovers(firestore, shareCode), handoverCode));
}

// ---------------------------------------------------------------------------
// The new owner
// ---------------------------------------------------------------------------

/**
 * Take a subscribed list over with the code its owner gave. Returns the new share key, which the
 * caller stores on the list as it makes it editable. Throws `HandoverRefusedError` when the rules
 * refuse the code.
 */
export async function acceptHandover(
  list: IPatternList,
  handoverCode: string,
): Promise<string> {
  const firestore = requireDb();
  const code = requireCode(list);
  const token = handoverCode.trim().toUpperCase();
  if (!/^[0-9A-Z]{10}$/.test(token)) throw new HandoverRefusedError();
  const uid = await ensureSignedIn();
  const shareKey = generateShareKey();
  const batch = writeBatch(firestore);
  batch.update(doc(handovers(firestore, code), token), {
    acceptedBy: uid,
    acceptedAt: serverTimestamp(),
  });
  batch.set(doc(firestore, SHARED_LIST_OWNERS_COLLECTION, code), {
    ownerUid: uid,
    key: shareKey,
    handover: token,
  });
  try {
    await batch.commit();
  } catch (e) {
    // A code that does not exist fails as not-found, the rest as refused.
    if (isPermissionDenied(e) || (e as { code?: string })?.code === "not-found")
      throw new HandoverRefusedError();
    throw e;
  }
  return shareKey;
}
