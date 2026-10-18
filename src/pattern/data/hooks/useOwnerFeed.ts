import { useEffect, useState } from "react";
import { Unsubscribe } from "firebase/firestore";
import { firebaseAvailable } from "@/src/firebase/firebaseConfig";
import { IPatternList } from "@/src/pattern/types/IPatternList";

/**
 * A live feed the publisher reads from their own published list (suggestions, mutes, members),
 * while `active`; empty otherwise. `subscribe` is one of the services' `subscribeTo…` calls.
 *
 * Only a different list or share code re-subscribes, not every save of the same list, and a
 * list switched since the last update shows nothing of the previous one.
 */
export function useOwnerFeed<T>(
  list: IPatternList | null | undefined,
  active: boolean,
  subscribe: (
    list: IPatternList,
    onUpdate: (items: T[]) => void,
    onError: (err: Error) => void,
  ) => Unsubscribe,
  label: string,
): { items: T[]; error: boolean } {
  const [state, setState] = useState<{
    key: string | null;
    items: T[];
    error: boolean;
  }>({ key: null, items: [], error: false });
  const key =
    active && firebaseAvailable && list ? `${list.id}:${list.shareCode}` : null;

  useEffect(() => {
    if (!key || !list) return;
    return subscribe(
      list,
      (items) => setState({ key, items, error: false }),
      (err) => {
        console.warn(`${label}:`, err.message);
        setState({ key, items: [], error: true });
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return state.key === key && key
    ? { items: state.items, error: state.error }
    : { items: [], error: false };
}
