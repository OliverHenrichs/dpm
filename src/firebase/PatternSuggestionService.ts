import {
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  Unsubscribe,
} from "firebase/firestore";
import {
  APP_TOKEN,
  SUBSCRIBERS,
  SHARED_LISTS_COLLECTION,
  SUGGESTION_COUNTERS,
  SUGGESTIONS,
} from "@/src/firebase/firebaseConfig";
import { ensureSignedIn } from "@/src/firebase/auth";
import {
  isPermissionDenied,
  requireDb,
  requireShareCode,
  sharedListCollection,
} from "@/src/firebase/firestoreAccess";
import { asOwner, subscribeAsOwner } from "@/src/firebase/ownership";
import {
  IPatternList,
  ISuggestionPolicy,
  NewPattern,
} from "@/src/pattern/types/IPatternList";
import {
  counterIdFor,
  suggestedPattern,
} from "@/src/pattern/suggestions/suggestions";

/**
 * Pattern suggestions from a published list's subscribers, under the list's document:
 *
 * - `suggestions/{auto id}`: one suggestion (`SuggestionDocument`), read only by the owner;
 * - `suggestionCounters/{d<day>[_<uid>]}`: how many were sent that UTC day, for the list or one
 *   subscriber, which is what the security rules hold the daily limit against;
 * - `subscribers/{uid}`: the publisher's record of a subscriber (`SubscriberRecord`): a mute,
 *   and on a members-only list a membership (`MembershipService.ts`).
 *
 * See `src/pattern/suggestions/AGENTS.md` and `firestore.rules`.
 */
/** `sharedLists/{code}/suggestions/{id}`, as `submitSuggestion` writes it. */
export interface SuggestionDocument {
  authorUid: string;
  authorName?: string;
  pattern: NewPattern;
  createdAt: Timestamp;
  appToken: string;
}

/** `sharedLists/{code}/suggestionCounters/{id}`. */
export interface SuggestionCounterDocument {
  count: number;
  /** The suggestion that brought the count to this value. */
  last: string;
}

/** A suggestion as the publisher's app shows it. */
export interface PatternSuggestion {
  id: string;
  authorUid: string;
  authorName?: string;
  /** Untrusted: another phone wrote it. `patternFromSuggestion` makes it safe to add. */
  pattern: unknown;
  /** Epoch milliseconds; 0 while the server has not stamped it. */
  createdAt: number;
}

/**
 * `sharedLists/{code}/subscribers/{uid}`: a mute, a membership of a members-only list
 * (`src/firebase/MembershipService.ts`), or both. One of the two is always there.
 */
export interface SubscriberRecord {
  status?: "muted";
  membership?: Membership;
  name?: string;
  updatedAt: Timestamp;
}

/** Where a subscriber stands with a members-only list. */
export type Membership = "requested" | "member" | "declined";

export interface MutedSubscriber {
  uid: string;
  name?: string;
}

/** Where a subscriber stands with a list today: muted, and how many suggestions are left. */
export interface SuggestionStanding {
  muted: boolean;
  remaining: number;
}

export type SubmitResult = "sent" | "muted" | "limit" | "closed";

// ---------------------------------------------------------------------------
// Subscriber
// ---------------------------------------------------------------------------

/**
 * Whether this phone may suggest today, and how many more. Signs in anonymously: the author id
 * is what the limit per subscriber, and muting, are held against.
 */
export async function getSuggestionStanding(
  shareCode: string,
  policy: ISuggestionPolicy,
): Promise<SuggestionStanding> {
  const firestore = requireDb();
  const uid = await ensureSignedIn();
  const [mute, counter] = await Promise.all([
    getDoc(doc(sharedListCollection(firestore, shareCode, SUBSCRIBERS), uid)),
    getDoc(
      doc(
        sharedListCollection(firestore, shareCode, SUGGESTION_COUNTERS),
        counterIdFor(policy, uid),
      ),
    ),
  ]);
  const used = counter.exists()
    ? ((counter.data() as SuggestionCounterDocument).count ?? 0)
    : 0;
  return {
    muted:
      mute.exists() && (mute.data() as SubscriberRecord).status === "muted",
    remaining: Math.max(0, policy.dailyLimit - used),
  };
}

/**
 * Send a suggestion. The suggestion and today's counter are written in one transaction, which
 * the rules accept only while the list takes suggestions, the caller is not muted and the count
 * stays within the limit. A refusal is told apart by asking again (`getSuggestionStanding`),
 * since the rules only say no.
 */
export async function submitSuggestion(
  shareCode: string,
  policy: ISuggestionPolicy,
  pattern: NewPattern,
  authorName?: string,
): Promise<SubmitResult> {
  const firestore = requireDb();
  const uid = await ensureSignedIn();
  const name = authorName?.trim().slice(0, 40);
  const suggestionRef = doc(
    sharedListCollection(firestore, shareCode, SUGGESTIONS),
  );
  const counterRef = doc(
    sharedListCollection(firestore, shareCode, SUGGESTION_COUNTERS),
    counterIdFor(policy, uid),
  );

  try {
    await runTransaction(firestore, async (tx) => {
      const counter = await tx.get(counterRef);
      const count = counter.exists()
        ? (counter.data() as SuggestionCounterDocument).count
        : 0;
      if (count >= policy.dailyLimit) throw new LimitReached();
      const data: Omit<SuggestionDocument, "createdAt"> & {
        createdAt: ReturnType<typeof serverTimestamp>;
      } = {
        authorUid: uid,
        ...(name && { authorName: name }),
        pattern: suggestedPattern(pattern),
        createdAt: serverTimestamp(),
        appToken: APP_TOKEN,
      };
      tx.set(suggestionRef, data);
      tx.set(counterRef, {
        count: count + 1,
        last: suggestionRef.id,
      } satisfies SuggestionCounterDocument);
    });
    return "sent";
  } catch (e) {
    if (e instanceof LimitReached) return "limit";
    if (!isPermissionDenied(e)) throw e;
    // Refused: say why if we can. The list may have stopped taking suggestions since this
    // copy synced, in which case the policy read here no longer exists.
    const list = await getDoc(
      doc(firestore, SHARED_LISTS_COLLECTION, shareCode),
    );
    const current = (list.data()?.list as IPatternList | undefined)
      ?.suggestions;
    if (!current) return "closed";
    const standing = await getSuggestionStanding(shareCode, current);
    if (standing.muted) return "muted";
    if (standing.remaining === 0) return "limit";
    throw e;
  }
}

class LimitReached extends Error {}

// ---------------------------------------------------------------------------
// Publisher
// ---------------------------------------------------------------------------

function toSuggestion(id: string, data: Record<string, unknown>) {
  const createdAt = data.createdAt;
  return {
    id,
    authorUid: typeof data.authorUid === "string" ? data.authorUid : "",
    ...(typeof data.authorName === "string" &&
      data.authorName.trim() && { authorName: data.authorName.trim() }),
    pattern: data.pattern,
    createdAt: createdAt instanceof Timestamp ? createdAt.toMillis() : 0,
  } satisfies PatternSuggestion;
}

/**
 * Live suggestions for the publisher's own list, oldest first. Calls `onError` once when they
 * cannot be read even after re-confirming ownership.
 */
export function subscribeToSuggestions(
  list: IPatternList,
  onUpdate: (suggestions: PatternSuggestion[]) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  return subscribeAsOwner(
    list,
    (firestore, code) =>
      query(
        sharedListCollection(firestore, code, SUGGESTIONS),
        orderBy("createdAt", "asc"),
      ),
    (docs) => onUpdate(docs.map(({ id, data }) => toSuggestion(id, data))),
    onError,
  );
}

/** Live list of the subscribers muted on the publisher's own list. */
export function subscribeToMutedSubscribers(
  list: IPatternList,
  onUpdate: (muted: MutedSubscriber[]) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  return subscribeAsOwner(
    list,
    (firestore, code) =>
      query(sharedListCollection(firestore, code, SUBSCRIBERS)),
    (docs) =>
      onUpdate(
        docs
          .filter(({ data }) => data.status === "muted")
          .map(({ id, data }) => ({
            uid: id,
            ...(typeof data.name === "string" && { name: data.name }),
          })),
      ),
    onError,
  );
}

/** Remove a suggestion: dismissed, or accepted and added to the list. */
export async function deleteSuggestion(
  list: IPatternList,
  suggestionId: string,
): Promise<void> {
  const firestore = requireDb();
  const code = requireShareCode(list);
  await asOwner(list, () =>
    deleteDoc(
      doc(sharedListCollection(firestore, code, SUGGESTIONS), suggestionId),
    ),
  );
}

/**
 * Stop taking suggestions from one subscriber. Their pending suggestions stay for review. A
 * merge, so a member of a members-only list stays a member.
 */
export async function muteSubscriber(
  list: IPatternList,
  uid: string,
  name?: string,
): Promise<void> {
  const firestore = requireDb();
  const code = requireShareCode(list);
  const trimmed = name?.trim().slice(0, 40);
  await asOwner(list, () =>
    setDoc(
      doc(sharedListCollection(firestore, code, SUBSCRIBERS), uid),
      {
        status: "muted",
        ...(trimmed && { name: trimmed }),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    ),
  );
}

/** Take a mute back. A record that also holds a membership keeps it. */
export async function unmuteSubscriber(
  list: IPatternList,
  uid: string,
): Promise<void> {
  const firestore = requireDb();
  const code = requireShareCode(list);
  const ref = doc(sharedListCollection(firestore, code, SUBSCRIBERS), uid);
  await asOwner(list, async () => {
    const record = await getDoc(ref);
    if ((record.data() as SubscriberRecord | undefined)?.membership) {
      await setDoc(
        ref,
        { status: deleteField(), updatedAt: serverTimestamp() },
        { merge: true },
      );
    } else {
      await deleteDoc(ref);
    }
  });
}
