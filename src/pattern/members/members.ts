import { IPatternList } from "@/src/pattern/types/IPatternList";
import { ListMember } from "@/src/firebase/MembershipService";

/** The publisher's own published list, closed to members only: who is let in is theirs to say. */
export function managesMembers(list: IPatternList | null | undefined): boolean {
  return !!list?.shareCode && !list.readonly && list.membersOnly === true;
}

/** The list with members-only on or off; off removes the key (Firestore rejects undefined). */
export function withMembersOnly(
  list: IPatternList,
  membersOnly: boolean,
): IPatternList {
  const { membersOnly: _previous, ...rest } = list;
  return membersOnly ? { ...rest, membersOnly: true } : rest;
}

/** Members grouped as the publisher answers them: waiting first, oldest request first. */
export function groupMembers(members: ListMember[]): {
  requested: ListMember[];
  member: ListMember[];
  declined: ListMember[];
} {
  const byAge = [...members].sort((a, b) => a.updatedAt - b.updatedAt);
  return {
    requested: byAge.filter((m) => m.membership === "requested"),
    member: byAge.filter((m) => m.membership === "member"),
    declined: byAge.filter((m) => m.membership === "declined"),
  };
}
