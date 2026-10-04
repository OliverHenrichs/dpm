import { useCallback, useEffect, useMemo, useState } from "react";
import { useFocusEffect } from "expo-router";
import { useActivePatternList } from "@/src/pattern/data/components/ActivePatternListContext";
import {
  loadAllPatternLists,
  loadPatterns,
} from "@/src/pattern/data/PatternListStorage";
import { collectReels, ListWithPatterns, Reel } from "@/src/reels/reels";

/** Whose videos the reels show: the open list's, or every list's on the phone. */
export type ReelScope = "list" | "all";

/**
 * The reels for a scope. The open list comes from the shared context, so an edit there shows
 * at once; the other lists are read from storage each time the screen comes into focus, since
 * nothing else holds them in memory.
 */
export function useReels(scope: ReelScope): {
  reels: Reel[];
  isLoading: boolean;
} {
  const { activeList, patterns } = useActivePatternList();
  const [otherLists, setOtherLists] = useState<ListWithPatterns[] | null>(null);

  // Counts the screen's visits, so the other lists are read again on each.
  const [visit, setVisit] = useState(0);
  useFocusEffect(useCallback(() => setVisit((v) => v + 1), []));

  useEffect(() => {
    if (scope !== "all") return;
    let cancelled = false;
    void (async () => {
      const lists = await loadAllPatternLists();
      const loaded = await Promise.all(
        lists
          .filter((list) => list.id !== activeList?.id)
          .map(async (list) => ({
            list,
            patterns: await loadPatterns(list.id),
          })),
      );
      if (!cancelled) setOtherLists(loaded);
    })();
    return () => {
      cancelled = true;
    };
  }, [scope, activeList?.id, visit]);

  const reels = useMemo(() => {
    const open: ListWithPatterns[] = activeList
      ? [{ list: activeList, patterns }]
      : [];
    if (scope === "list") return collectReels(open);
    return collectReels([...open, ...(otherLists ?? [])]);
  }, [scope, activeList, patterns, otherLists]);

  return { reels, isLoading: scope === "all" && otherLists === null };
}
