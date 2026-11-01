import { useEffect, useRef, useState } from "react";
import {
  NoAccessError,
  subscribeToSharedList,
} from "@/src/firebase/FirebaseListService";
import {
  refreshSubscription,
  removeSubscription,
} from "@/src/firebase/SubscriptionService";
import {
  getPatternListById,
  savePatternList,
  savePatterns,
} from "@/src/pattern/data/PatternListStorage";
import { PatternListWithPatterns } from "@/src/pattern/data/types/IExportData";

/**
 * Maintains a live Firestore subscription for a single shared list.
 *
 * A subscribed (read-only) copy takes every update. The publisher's own list
 * ignores them: its local copy is the truth, and a late echo of an older push
 * would otherwise overwrite newer local changes.
 *
 * When the publisher unpublishes (document deleted), the local copy is kept,
 * made editable, shareCode cleared, and detachedListName is set so the caller
 * can render a themed AppDialog notification. A subscriber who may no longer
 * read the list (it became members-only, or the publisher removed them) is
 * detached the same way, with `detachedReason` saying so.
 *
 * A subscriber's phone counts itself towards the publisher's subscriber count
 * once it has read the list (`SubscriptionService.ts`), and stops counting
 * when the list is detached.
 */
export function useSharedList(
  shareCode: string | undefined,
  listId: string | undefined,
  onUpdated: () => void,
  membersOnly = false,
): {
  detachedListName: string | null;
  detachedReason: DetachReason;
  clearDetachedName: () => void;
} {
  const onUpdatedRef = useRef(onUpdated);
  useEffect(() => {
    onUpdatedRef.current = onUpdated;
  });

  const [detached, setDetached] = useState<{
    name: string;
    reason: DetachReason;
  } | null>(null);
  const clearDetachedName = () => setDetached(null);

  useEffect(() => {
    if (!shareCode) return;

    return subscribeToSharedList(
      shareCode,
      async (updated: PatternListWithPatterns) => {
        try {
          // The update lands on the list this subscription belongs to, never on whichever list
          // the published document names: a publisher could otherwise copy another shared
          // list's id into theirs and overwrite that list on every phone following both.
          if (!listId || updated.id !== listId) return;
          const existing = await getPatternListById(listId);
          // Only a subscriber takes the cloud's copy. On the publisher's own
          // device the local list is the source of truth, and what comes back
          // may be an echo of an older push — writing it over local storage
          // lost patterns added since.
          if (!existing?.readonly || existing.shareCode !== shareCode) return;
          const listToSave = { ...updated, readonly: existing.readonly };
          await savePatternList(listToSave);
          await savePatterns(updated.id, updated.patterns);
          onUpdatedRef.current();
          refreshSubscription(shareCode).catch((err) =>
            console.warn("useSharedList: failed to count subscription", err),
          );
        } catch (err) {
          console.warn("useSharedList: failed to persist update", err);
        }
      },
      async (err) => {
        const noAccess = err instanceof NoAccessError;
        if (
          (err.message === "Shared list no longer exists." || noAccess) &&
          listId
        ) {
          try {
            const existing = await getPatternListById(listId);
            // The publisher's own list is never refused to its owner for long: ownership is
            // re-confirmed on the next publish. Only a subscriber's copy is detached.
            if (existing && (!noAccess || existing.readonly)) {
              await savePatternList({
                ...existing,
                shareCode: undefined,
                readonly: undefined,
              });
              onUpdatedRef.current();
              removeSubscription(shareCode).catch(() => {
                // The list is gone or closed to this phone; the record ages out.
              });
              // Only notify subscribers — publishers have readonly === undefined
              if (existing.readonly) {
                setDetached({
                  name: existing.name,
                  reason: noAccess ? "noAccess" : "unpublished",
                });
              }
            }
          } catch (saveErr) {
            console.warn("useSharedList: failed to detach list", saveErr);
          }
        } else {
          console.warn("useSharedList: subscription error", err.message);
        }
      },
      { membersOnly },
    );
  }, [shareCode, listId, membersOnly]);

  return {
    detachedListName: detached?.name ?? null,
    detachedReason: detached?.reason ?? "unpublished",
    clearDetachedName,
  };
}

/** Why a subscribed list stopped syncing: unpublished, or no longer readable by this phone. */
export type DetachReason = "unpublished" | "noAccess";
