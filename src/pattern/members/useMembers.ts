import { useEffect, useState } from "react";
import { firebaseAvailable } from "@/src/firebase/firebaseConfig";
import {
  ListMember,
  subscribeToMembers,
} from "@/src/firebase/MembershipService";
import { IPatternList } from "@/src/pattern/types/IPatternList";
import { managesMembers } from "@/src/pattern/members/members";

/**
 * Live requests to join and members of the publisher's own members-only list; empty for any
 * other list.
 */
export function useMembers(list: IPatternList | null | undefined): {
  members: ListMember[];
  error: boolean;
} {
  const [state, setState] = useState<{
    key: string | null;
    members: ListMember[];
    error: boolean;
  }>({ key: null, members: [], error: false });
  const active = firebaseAvailable && managesMembers(list);
  const key = active && list ? `${list.id}:${list.shareCode}` : null;

  useEffect(() => {
    if (!key || !list) return;
    return subscribeToMembers(
      list,
      (members) => setState({ key, members, error: false }),
      (err) => {
        console.warn("useMembers:", err.message);
        setState({ key, members: [], error: true });
      },
    );
    // Only a different list or code re-subscribes, not every save of the same list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return state.key === key && key
    ? { members: state.members, error: state.error }
    : { members: [], error: false };
}
