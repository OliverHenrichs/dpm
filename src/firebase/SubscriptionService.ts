import {
  deleteDoc,
  doc,
  Firestore,
  getCountFromServer,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
} from "firebase/firestore";
import {
  APP_TOKEN,
  db,
  firebaseAvailable,
  SUBSCRIPTIONS,
} from "@/src/firebase/firebaseConfig";
import {
  requireDb,
  sharedListCollection,
} from "@/src/firebase/firestoreAccess";
import { asOwner } from "@/src/firebase/ownership";
import {
  forgetSubscriptionId,
  getSubscriptionId,
  peekSubscriptionId,
} from "@/src/pattern/data/SubscriptionStorage";
import { IPatternList } from "@/src/pattern/types/IPatternList";

/**
 * The subscriber count of a published list: `sharedLists/{code}/subscriptions/{id}`, one record
 * per subscribing phone, named by a random id the phone keeps for that list
 * (`SubscriptionStorage.ts`) and holding only when the phone last synced it. Subscribers do not
 * sign in for it, and the id is not their anonymous user id. Only the owner may list the records,
 * so the publisher reads a count and nobody else learns anything.
 *
 * A record goes when the subscriber unsubscribes or the publisher stops sharing. A phone that is
 * simply uninstalled cannot say so, which is why the count only takes records synced within
 * `ACTIVE_SUBSCRIPTION_DAYS`. See `src/firebase/AGENTS.md` and `firestore.rules`.
 */
export const ACTIVE_SUBSCRIPTION_DAYS = 90;

/** `sharedLists/{code}/subscriptions/{id}`, as `refreshSubscription` writes it. */
export interface SubscriptionDocument {
  seenAt: Timestamp;
  appToken: string;
}

function subscriptions(firestore: Firestore, shareCode: string) {
  return sharedListCollection(firestore, shareCode, SUBSCRIPTIONS);
}

/** Share codes this run of the app has already counted: once per launch is enough. */
const refreshed = new Set<string>();

/**
 * Count this phone as a subscriber of a shared list it has just read, or say it is still there.
 * Once per share code per launch; a failure is left for the next launch to retry.
 */
export async function refreshSubscription(shareCode: string): Promise<void> {
  if (refreshed.has(shareCode)) return;
  const firestore = requireDb();
  refreshed.add(shareCode);
  try {
    const id = await getSubscriptionId(shareCode);
    await setDoc(doc(subscriptions(firestore, shareCode), id), {
      seenAt: serverTimestamp(),
      appToken: APP_TOKEN,
    });
  } catch (e) {
    refreshed.delete(shareCode);
    throw e;
  }
}

/**
 * Stop counting this phone for a list: on unsubscribing, or when the list stopped syncing. The
 * local id goes even when the delete fails (offline, list already gone); the record then drops
 * out of the count once it is older than `ACTIVE_SUBSCRIPTION_DAYS`.
 */
export async function removeSubscription(shareCode: string): Promise<void> {
  refreshed.delete(shareCode);
  const id = await peekSubscriptionId(shareCode);
  if (!id) return;
  await forgetSubscriptionId(shareCode);
  if (!firebaseAvailable || !db) return;
  await deleteDoc(doc(subscriptions(db, shareCode), id));
}

/** How many phones synced the publisher's list within `ACTIVE_SUBSCRIPTION_DAYS`. */
export async function countSubscribers(list: IPatternList): Promise<number> {
  const firestore = requireDb();
  const code = list.shareCode;
  if (!code)
    throw new Error("Cannot count subscribers: list has no shareCode.");
  const since = Timestamp.fromMillis(
    Date.now() - ACTIVE_SUBSCRIPTION_DAYS * 24 * 60 * 60 * 1000,
  );
  const snap = await asOwner(list, () =>
    getCountFromServer(
      query(subscriptions(firestore, code), where("seenAt", ">=", since)),
    ),
  );
  return snap.data().count;
}
