# Members-only lists — `src/pattern/members/`

A publisher can close a published list so only the subscribers they let in may read it. Without
it, anyone who knows the share code reads the list and every video link in it; with it, the code
alone gets a stranger nothing but a way to ask. Phase 2 of the private video hosts plan
(`ideas/private-video-hosts.md` in the project files). A member can still copy a link out of the
app: this stops strangers with the code, not a member who forwards a video.

## The setting

`IPatternList.membersOnly?: true`. Absent means open; switching off **removes the key**
(`withMembersOnly`, Firestore rejects `undefined`). It is published with the list, so a member's
copy carries it, set in `ShareListModal` next to the suggestions switch (a published list
publishes the change at once, after a confirmation, since closing a list shuts out everyone
subscribed so far), and exported since format 3.7.

## Firestore (`src/firebase/MembershipService.ts`, `firestore.rules`)

A membership is a field of the publisher's record of a subscriber,
`sharedLists/{code}/subscribers/{uid}`, the record pattern suggestions keep mutes in
(`src/pattern/suggestions/AGENTS.md`): `{ status?: "muted", membership?: "requested" | "member" |
"declined", name?, updatedAt }`, one of the two always present. Writes **merge**, so a mute and a
membership never erase each other; unmuting a member removes only `status`.

- **Reading the list.** `sharedLists/{code}` is readable by anyone while the list is open; once
  `list.membersOnly` is set, only by a `member` and the owner. A code that does not exist still
  reads as not-found (`resource == null`), so a refusal always means "members only".
- **Asking.** A subscriber signs in anonymously (`ensureSignedIn`) and writes their own record with
  `membership: "requested"` and an optional name. Allowed once, only on a members-only list, and
  never with a mute or any other membership: a record that has a membership is the owner's to
  change. A muted subscriber may still ask; the mute stays.
- **Answering.** The owner sets `member` or `declined` (`setMembership`). _Remove_ is `declined`
  too, so a removed member cannot simply ask again; _Let in_ undoes it.
- **Suggestions** to a members-only list come from members only.
- `unpublishList` deletes the subscriber records with the rest of the suggestion data.

## Signing in, and when not to

Subscribing to an open list still never signs in. Looking a members-only code up does not
either: `fetchSharedList` throws `MembersOnlyError`, and `getOwnMembership` reads where the phone
stands only if it **already** has an id (`restoreSignIn`, which never creates one). Only _Ask to
join_ signs in.

A member's requests must carry their id, which Firestore attaches only once auth has been
restored. So `fetchSharedList` retries a refusal once after `restoreSignIn`, and
`subscribeToSharedList` restores it before listening to a list stored as `membersOnly`, and
retries once on a refusal before reporting `NoAccessError`.

## The app

- `SubscribeListModal`: a members-only code shows _This list is for members only_ with _Ask to
  join_ (and a name), _Look up again_ while waiting, or that the publisher turned the phone away.
  There is no live wait: the subscriber looks the code up again once let in.
- The publisher's List tab header shows a people button with the number waiting
  (`SuggestionsButton` with other icons) on their own members-only list (`managesMembers`); it opens
  `MembersModal`: waiting (_Let in_, _Decline_), members (_Remove_, confirmed), turned away (_Let
  in_). `useMembers` listens while that list is published.
- **Losing access** (`useSharedList`): a subscriber's copy that is refused (the list became
  members-only, or they were removed) is detached like an unpublished one, kept and made editable,
  with `listNoAccessMessage`. The publisher's own list is never detached that way.
- Tests: rules in `__tests__/rules/firestore.rules.test.ts` ("members-only lists"), components in
  `__tests__/components/MembersOnly.test.tsx`.
