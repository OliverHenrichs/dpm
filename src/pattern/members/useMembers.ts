import {
  ListMember,
  subscribeToMembers,
} from "@/src/firebase/MembershipService";
import { IPatternList } from "@/src/pattern/types/IPatternList";
import { managesMembers } from "@/src/pattern/members/members";
import { useOwnerFeed } from "@/src/pattern/data/hooks/useOwnerFeed";

/**
 * Live requests to join and members of the publisher's own members-only list; empty for any
 * other list.
 */
export function useMembers(list: IPatternList | null | undefined): {
  members: ListMember[];
  error: boolean;
} {
  const { items, error } = useOwnerFeed(
    list,
    managesMembers(list),
    subscribeToMembers,
    "useMembers",
  );
  return { members: items, error };
}
