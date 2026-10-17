import {
  MutedSubscriber,
  PatternSuggestion,
  subscribeToMutedSubscribers,
  subscribeToSuggestions,
} from "@/src/firebase/PatternSuggestionService";
import { IPatternList } from "@/src/pattern/types/IPatternList";
import { receivesSuggestions } from "@/src/pattern/suggestions/suggestions";
import { useOwnerFeed } from "@/src/pattern/data/hooks/useOwnerFeed";

/**
 * Live suggestions for the publisher's own published list; empty for any other list. Listens
 * while the list is published, whether or not it takes suggestions now, so ones sent before
 * they were switched off can still be reviewed.
 */
export function useListSuggestions(list: IPatternList | null | undefined): {
  suggestions: PatternSuggestion[];
  error: boolean;
} {
  const { items, error } = useOwnerFeed(
    list,
    receivesSuggestions(list),
    subscribeToSuggestions,
    "useListSuggestions",
  );
  return { suggestions: items, error };
}

/** Live list of the subscribers muted on the publisher's own list. */
export function useMutedSubscribers(
  list: IPatternList | null | undefined,
): MutedSubscriber[] {
  return useOwnerFeed(
    list,
    receivesSuggestions(list),
    subscribeToMutedSubscribers,
    "useMutedSubscribers",
  ).items;
}
