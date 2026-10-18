import {
  collection,
  doc,
  Firestore,
  getDoc,
  query,
  serverTimestamp,
  setDoc,
  Unsubscribe,
} from "firebase/firestore";
import {
  SHARED_LISTS_COLLECTION,
  SUBSCRIBERS,
} from "@/src/firebase/firebaseConfig";
import { ensureSignedIn, restoreSignIn } from "@/src/firebase/auth";
import {
  isPermissionDenied,
  requireDb,
  sharedListCollection,
} from "@/src/firebase/firestoreAccess";
import { asOwner, subscribeAsOwner } from "@/src/firebase/ownership";
import type {
  Membership,
  SubscriberRecord,
} from "@/src/firebase/PatternSuggestionService";
import { IPatternList } from "@/src/pattern/types/IPatternList";

/**
 * Members-only lists (`IPatternList.membersOnly`): only subscribers the publisher has let in may
 * read the published list. A membership lives in the publisher's record of the subscriber,
 * `sharedLists/{code}/subscribers/{uid}` (`SubscriberRecord.membership`), next to a mute. See
 * `src/pattern/members/AGENTS.md` and `firestore.rules`.
 */

/** A subscriber with a membership, as the publisher's app lists them. */
export interface ListMember {
  uid: string;
  membership: Membership;
  name?: string;
  /** Epoch milliseconds of the last change; 0 while the server has not stamped it. */
  updatedAt: number;
}

function recordRef(firestore: Firestore, code: string, uid: string) {
  return doc(sharedListCollection(firestore, code, SUBSCRIBERS), uid);
}

function membershipOf(data: unknown): Membership | null {
  const value = (data as SubscriberRecord | undefined)?.membership;
  return value === "requested" || value === "member" || value === "declined"
    ? value
    : null;
}

// ---------------------------------------------------------------------------
// Subscriber
// ---------------------------------------------------------------------------

/**
 * Where this phone stands with a members-only list, without signing in: null when it has no id
 * yet, or has never asked.
 */
export async function getOwnMembership(
  shareCode: string,
): Promise<Membership | null> {
  const firestore = requireDb();
  const uid = await restoreSignIn();
  if (!uid) return null;
  const snap = await getDoc(recordRef(firestore, shareCode.toUpperCase(), uid));
  return snap.exists() ? membershipOf(snap.data()) : null;
}

/**
 * Ask to join a members-only list, with an optional name for the publisher. Signs in
 * anonymously: the id is what the publisher lets in. Asking is allowed once; after that the
 * answer is the publisher's, so a refusal is answered with where this phone stands.
 */
export async function requestMembership(
  shareCode: string,
  name?: string,
): Promise<Membership> {
  const firestore = requireDb();
  const code = shareCode.toUpperCase();
  const uid = await ensureSignedIn();
  const trimmed = name?.trim().slice(0, 40);
  const ref = recordRef(firestore, code, uid);
  try {
    // A merge: a subscriber the publisher muted keeps the mute.
    await setDoc(
      ref,
      {
        membership: "requested",
        ...(trimmed && { name: trimmed }),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    return "requested";
  } catch (e) {
    if (!isPermissionDenied(e)) throw e;
    const current = await getDoc(ref);
    const membership = current.exists() ? membershipOf(current.data()) : null;
    if (membership) return membership;
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Publisher
// ---------------------------------------------------------------------------

/** Live list of everyone who asked to join the publisher's own list, or was let in. */
export function subscribeToMembers(
  list: IPatternList,
  onUpdate: (members: ListMember[]) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  return subscribeAsOwner(
    list,
    (firestore, code) =>
      query(
        collection(doc(firestore, SHARED_LISTS_COLLECTION, code), SUBSCRIBERS),
      ),
    (docs) =>
      onUpdate(
        docs.flatMap(({ id, data }) => {
          const membership = membershipOf(data);
          if (!membership) return [];
          const updatedAt = data.updatedAt as { toMillis?: () => number };
          return [
            {
              uid: id,
              membership,
              ...(typeof data.name === "string" &&
                data.name.trim() && { name: data.name.trim() }),
              updatedAt:
                typeof updatedAt?.toMillis === "function"
                  ? updatedAt.toMillis()
                  : 0,
            },
          ];
        }),
      ),
    onError,
  );
}

/**
 * Let a subscriber in (`member`), or turn them away (`declined`): asking was refused, or a
 * member is removed. A declined subscriber cannot ask again until let in. A merge, so a mute
 * stays as it was.
 */
export async function setMembership(
  list: IPatternList,
  uid: string,
  membership: Exclude<Membership, "requested">,
): Promise<void> {
  const firestore = requireDb();
  const code = list.shareCode;
  if (!code) throw new Error("The list is not published.");
  await asOwner(list, () =>
    setDoc(
      recordRef(firestore, code, uid),
      { membership, updatedAt: serverTimestamp() },
      { merge: true },
    ),
  );
}
