import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  Firestore,
  getDoc,
  onSnapshot,
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
  db,
  firebaseAvailable,
  SUBSCRIBERS,
  SHARED_LISTS_COLLECTION,
  SUGGESTION_COUNTERS,
  SUGGESTIONS,
} from "@/src/firebase/firebaseConfig";
import { ensureSignedIn } from "@/src/firebase/auth";
import { confirmOwnership } from "@/src/firebase/FirebaseListService";
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

function requireDb(): Firestore {
  if (!firebaseAvailable || !db) {
    throw new Error("Firebase is not configured.");
  }
  return db;
}

function listDoc(firestore: Firestore, code: string) {
  return doc(firestore, SHARED_LISTS_COLLECTION, code);
}

function sub(firestore: Firestore, code: string, name: string) {
  return collection(listDoc(firestore, code), name);
}

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
    getDoc(doc(sub(firestore, shareCode, SUBSCRIBERS), uid)),
    getDoc(
      doc(
        sub(firestore, shareCode, SUGGESTION_COUNTERS),
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
  const suggestionRef = doc(sub(firestore, shareCode, SUGGESTIONS));
  const counterRef = doc(
    sub(firestore, shareCode, SUGGESTION_COUNTERS),
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
    const list = await getDoc(listDoc(firestore, shareCode));
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

export function isPermissionDenied(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    (e as { code?: string }).code === "permission-denied"
  );
}

// ---------------------------------------------------------------------------
// Publisher
// ---------------------------------------------------------------------------

/**
 * Run `attempt` as the list's owner. The rules check the owner record, which names this phone's
 * anonymous id only once it has published from it: after a reinstall, or on a new phone with an
 * editable export, the first refusal re-confirms ownership with the share key and tries again.
 */
export async function asOwner<T>(
  list: IPatternList,
  attempt: () => Promise<T>,
): Promise<T> {
  await ensureSignedIn();
  try {
    return await attempt();
  } catch (e) {
    if (!isPermissionDenied(e)) throw e;
    await confirmOwnership(list);
    return attempt();
  }
}

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
      query(sub(firestore, code, SUGGESTIONS), orderBy("createdAt", "asc")),
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
    (firestore, code) => query(sub(firestore, code, SUBSCRIBERS)),
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

export function subscribeAsOwner(
  list: IPatternList,
  build: (firestore: Firestore, code: string) => ReturnType<typeof query>,
  onDocs: (docs: { id: string; data: Record<string, unknown> }[]) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  if (!firebaseAvailable || !db || !list.shareCode) {
    onError(new Error("Firebase is not configured."));
    return () => {};
  }
  const firestore = db;
  const code = list.shareCode;
  let unsubscribe: Unsubscribe | null = null;
  let stopped = false;
  let retried = false;

  const listen = () => {
    if (stopped) return;
    unsubscribe = onSnapshot(
      build(firestore, code),
      (snap) =>
        onDocs(
          snap.docs.map((d) => ({
            id: d.id,
            data: d.data() as Record<string, unknown>,
          })),
        ),
      (err) => {
        if (!retried && isPermissionDenied(err)) {
          retried = true;
          confirmOwnership(list).then(listen, (e: unknown) =>
            onError(e instanceof Error ? e : new Error(String(e))),
          );
          return;
        }
        onError(new Error(err.message));
      },
    );
  };

  ensureSignedIn().then(listen, (e: unknown) =>
    onError(e instanceof Error ? e : new Error(String(e))),
  );

  return () => {
    stopped = true;
    unsubscribe?.();
  };
}

/** Remove a suggestion: dismissed, or accepted and added to the list. */
export async function deleteSuggestion(
  list: IPatternList,
  suggestionId: string,
): Promise<void> {
  const firestore = requireDb();
  const code = requireCode(list);
  await asOwner(list, () =>
    deleteDoc(doc(sub(firestore, code, SUGGESTIONS), suggestionId)),
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
  const code = requireCode(list);
  const trimmed = name?.trim().slice(0, 40);
  await asOwner(list, () =>
    setDoc(
      doc(sub(firestore, code, SUBSCRIBERS), uid),
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
  const code = requireCode(list);
  const ref = doc(sub(firestore, code, SUBSCRIBERS), uid);
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

function requireCode(list: IPatternList): string {
  if (!list.shareCode) throw new Error("The list is not published.");
  return list.shareCode;
}
