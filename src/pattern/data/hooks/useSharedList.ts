import { useEffect, useRef } from "react";
import { subscribeToSharedList } from "@/src/firebase/FirebaseListService";
import {
  savePatternList,
  savePatterns,
} from "@/src/pattern/data/PatternListStorage";
import { PatternListWithPatterns } from "@/src/pattern/data/types/IExportData";

/**
 * Maintains a live Firestore subscription for a single shared list.
 *
 * When the publisher pushes changes the updated list and its patterns are
 * written to local AsyncStorage, then onUpdated() is called so callers can
 * refresh their in-memory state.
 *
 * The subscription is automatically torn down when shareCode changes or the
 * component unmounts.
 */
export function useSharedList(
  shareCode: string | undefined,
  onUpdated: () => void,
): void {
  // Stable callback ref so the effect does not re-subscribe on every render
  const onUpdatedRef = useRef(onUpdated);
  useEffect(() => {
    onUpdatedRef.current = onUpdated;
  });

  useEffect(() => {
    if (!shareCode) return;

    const unsub = subscribeToSharedList(
      shareCode,
      async (updated: PatternListWithPatterns) => {
        try {
          await savePatternList(updated);
          await savePatterns(updated.id, updated.patterns);
          onUpdatedRef.current();
        } catch (err) {
          console.warn("useSharedList: failed to persist update", err);
        }
      },
      (err) => {
        console.warn("useSharedList: subscription error", err.message);
      },
    );

    return unsub;
  }, [shareCode]);
}


