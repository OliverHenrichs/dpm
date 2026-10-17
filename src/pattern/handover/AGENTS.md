# Handing a list over — `src/pattern/handover/`

A publisher who no longer wants to look after a list (a teacher leaving a course) hands it to
someone who already follows it. The list keeps its **share code**, so every subscriber keeps
following it and nobody republishes a copy; that duplication is what this replaces.

## How it works (`src/firebase/HandoverService.ts`, `firestore.rules`)

1. **Offer.** In `ShareListModal` (`HandoverSection`), the owner confirms and gets a 10-character
   **handover code** (QR too). It is the id of `sharedLists/{code}/handovers/{handoverCode}`:
   `{ fromUid, offeredAt }`. One offer per phone at a time (a new one deletes the old); _Withdraw_
   deletes it. On a members-only list the owner first writes their own subscriber record as
   `member`, so their phone can still read the list once it is someone else's.
2. **Accept.** On a subscribed (read-only) copy, the Lists screen's ⋮ sheet offers _Take over this
   list_ (`TakeOverListModal`). `acceptHandover` commits one batch: the offer gets `acceptedBy`
   and `acceptedAt`, and the owner record becomes `{ ownerUid: me, key: <fresh share key>,
handover: <handoverCode> }`. The rules let the owner record change its key only in a batch that
   accepts an open offer (exists, not accepted before, under 7 days old) for the caller, and only
   while the list exists, so a taken-down list (the takedown record of `tools/data-removal`) cannot be claimed, and a
   blocked id (`blockedUsers`) cannot accept. The
   new phone stores the list without `readonly`, with the new key: it is the publisher now.
3. **Follow.** The old key no longer matches, so the old owner can neither publish nor take the
   list back. `useHandedOver` (in `ActivePatternListProvider`, for the active list this phone
   publishes) listens to the phone's own offers (`fromUid`, readable by its maker after the
   handover) and, on one accepted by someone else, makes the list a subscribed copy (`readonly`,
   which drops the share key in `savePatternList`), fills it with what is published now, deletes
   the offer and shows _List handed over_. `useSharedList` keeps it in sync from then on.

What does **not** move: videos that live only on the old owner's phone, transcripts and the manual
graph layout (none of them are published). Suggestions, mutes and members stay under the list, so
the new owner sees them. The confirmation dialog says so.

## Notes

- The code is the secret, not a uid: open lists have no roster of subscribers, so there is no one
  to pick from. Whoever enters it first, within 7 days (`HANDOVER_DAYS`, also in the rules), wins.
- The old owner learns of the handover only while that list is active on their phone. Until then
  their edits stay local (pushes are refused, and a failed push never fails a local edit).
- `unpublishList` deletes the `handovers` subcollection with the suggestion data. The operator's
  data tool (`tools/data-removal`) finds offers too, and `remove-user` deletes the ones a user
  made or accepted.
- Tests: rules in `__tests__/rules/firestore.rules.test.ts` ("handing over"), components in
  `__tests__/components/Handover.test.tsx`.
