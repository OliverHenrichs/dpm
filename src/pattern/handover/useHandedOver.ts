import { useEffect, useRef, useState } from "react";
import { fetchSharedList } from "@/src/firebase/FirebaseListService";
import {
  clearAcceptedHandover,
  subscribeToAcceptedHandover,
} from "@/src/firebase/HandoverService";
import {
  getPatternListById,
  savePatternList,
  savePatterns,
} from "@/src/pattern/data/PatternListStorage";
import { IPatternList } from "@/src/pattern/types/IPatternList";

/**
 * On the publisher's phone, watches the active list for a handover someone accepted
 * (`src/pattern/handover/`). When one is, the list becomes a subscribed copy: read-only, without
 * its share key, and filled with what is published now, since `useSharedList` only takes changes
 * from here on. `handedOverName` names it for the notice.
 */
export function useHandedOver(
  list: IPatternList | null,
  onUpdated: () => void,
): { handedOverName: string | null; clearHandedOver: () => void } {
  const onUpdatedRef = useRef(onUpdated);
  useEffect(() => {
    onUpdatedRef.current = onUpdated;
  });
  const [handedOverName, setHandedOverName] = useState<string | null>(null);

  // Only a list this phone publishes can be handed over from it.
  const shareCode = list && !list.readonly ? list.shareCode : undefined;
  const listId = list?.id;

  useEffect(() => {
    if (!shareCode || !listId) return;
    return subscribeToAcceptedHandover(shareCode, async (handoverCode) => {
      try {
        const existing = await getPatternListById(listId);
        if (!existing || existing.readonly || existing.shareCode !== shareCode)
          return;
        await savePatternList({ ...existing, readonly: true });
        const published = await fetchSharedList(shareCode).catch(() => null);
        if (published) {
          const { patterns, ...rest } = published;
          await savePatternList({ ...rest, readonly: true });
          await savePatterns(listId, patterns);
        }
        await clearAcceptedHandover(shareCode, handoverCode).catch(
          () => undefined,
        );
        onUpdatedRef.current();
        setHandedOverName(existing.name);
      } catch (err) {
        console.warn("useHandedOver: failed to follow the handover", err);
      }
    });
  }, [shareCode, listId]);

  return {
    handedOverName,
    clearHandedOver: () => setHandedOverName(null),
  };
}
