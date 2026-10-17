import { onSnapshot, query, Firestore, Unsubscribe } from "firebase/firestore";
import { db, firebaseAvailable } from "@/src/firebase/firebaseConfig";
import { ensureSignedIn } from "@/src/firebase/auth";
import { confirmOwnership } from "@/src/firebase/FirebaseListService";
import { isPermissionDenied } from "@/src/firebase/firestoreAccess";
import { IPatternList } from "@/src/pattern/types/IPatternList";

/** Requests the security rules allow only the owner on record of a list to make. */

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

/**
 * Listen to a query as the list's owner, re-confirming ownership once on a refusal, as
 * `asOwner` does for a single request. Calls `onError` once when it is refused even then.
 */
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
