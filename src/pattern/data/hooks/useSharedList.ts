import { useEffect, useRef, useState } from "react";
import { subscribeToSharedList } from "@/src/firebase/FirebaseListService";
import {
  getPatternListById,
  savePatternList,
  savePatterns,
} from "@/src/pattern/data/PatternListStorage";
import { PatternListWithPatterns } from "@/src/pattern/data/types/IExportData";

/**
 * Maintains a live Firestore subscription for a single shared list.
 *
 * When the publisher unpublishes (document deleted), the local copy is kept,
 * made editable, shareCode cleared, and detachedListName is set so the caller
 * can render a themed AppDialog notification.
 */
export function useSharedList(
  shareCode: string | undefined,
  listId: string | undefined,
  onUpdated: () => void,
): { detachedListName: string | null; clearDetachedName: () => void } {
  const onUpdatedRef = useRef(onUpdated);
  useEffect(() => {
    onUpdatedRef.current = onUpdated;
  });

  const [detachedListName, setDetachedListName] = useState<string | null>(null);
  const clearDetachedName = () => setDetachedListName(null);

  useEffect(() => {
    if (!shareCode) return;

    return subscribeToSharedList(
      shareCode,
      async (updated: PatternListWithPatterns) => {
        try {
          const existing = await getPatternListById(updated.id);
          const listToSave = { ...updated, readonly: existing?.readonly };
          await savePatternList(listToSave);
          await savePatterns(updated.id, updated.patterns);
          onUpdatedRef.current();
        } catch (err) {
          console.warn("useSharedList: failed to persist update", err);
        }
      },
      async (err) => {
        if (err.message === "Shared list no longer exists." && listId) {
          try {
            const existing = await getPatternListById(listId);
            if (existing) {
              await savePatternList({
                ...existing,
                shareCode: undefined,
                readonly: undefined,
              });
              onUpdatedRef.current();
              // Only notify subscribers — publishers have readonly === undefined
              if (existing.readonly) {
                setDetachedListName(existing.name);
              }
            }
          } catch (saveErr) {
            console.warn("useSharedList: failed to detach list", saveErr);
          }
        } else {
          console.warn("useSharedList: subscription error", err.message);
        }
      },
    );
  }, [shareCode, listId]);

  return { detachedListName, clearDetachedName };
}
