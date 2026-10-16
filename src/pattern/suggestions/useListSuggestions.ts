import { useEffect, useState } from "react";
import { firebaseAvailable } from "@/src/firebase/firebaseConfig";
import {
  MutedSubscriber,
  PatternSuggestion,
  subscribeToMutedSubscribers,
  subscribeToSuggestions,
} from "@/src/firebase/PatternSuggestionService";
import { IPatternList } from "@/src/pattern/types/IPatternList";
import { receivesSuggestions } from "@/src/pattern/suggestions/suggestions";

/**
 * Live suggestions for the publisher's own published list; empty for any other list. Listens
 * while the list is published, whether or not it takes suggestions now, so ones sent before
 * they were switched off can still be reviewed.
 */
export function useListSuggestions(list: IPatternList | null | undefined): {
  suggestions: PatternSuggestion[];
  error: boolean;
} {
  const [state, setState] = useState<{
    key: string | null;
    suggestions: PatternSuggestion[];
    error: boolean;
  }>({ key: null, suggestions: [], error: false });
  const active = firebaseAvailable && receivesSuggestions(list);
  const key = active && list ? `${list.id}:${list.shareCode}` : null;

  useEffect(() => {
    if (!key || !list) return;
    return subscribeToSuggestions(
      list,
      (suggestions) => setState({ key, suggestions, error: false }),
      (err) => {
        console.warn("useListSuggestions:", err.message);
        setState({ key, suggestions: [], error: true });
      },
    );
    // Only a different list or code re-subscribes, not every save of the same list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // A list switched since the last update shows nothing of the previous one.
  return state.key === key && key
    ? { suggestions: state.suggestions, error: state.error }
    : { suggestions: [], error: false };
}

/** Live list of the subscribers muted on the publisher's own list, while `enabled`. */
export function useMutedSubscribers(
  list: IPatternList | null | undefined,
  enabled: boolean,
): MutedSubscriber[] {
  const [state, setState] = useState<{
    key: string | null;
    muted: MutedSubscriber[];
  }>({ key: null, muted: [] });
  const active = enabled && firebaseAvailable && receivesSuggestions(list);
  const key = active && list ? `${list.id}:${list.shareCode}` : null;

  useEffect(() => {
    if (!key || !list) return;
    return subscribeToMutedSubscribers(
      list,
      (muted) => setState({ key, muted }),
      (err) => console.warn("useMutedSubscribers:", err.message),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return state.key === key && key ? state.muted : [];
}
