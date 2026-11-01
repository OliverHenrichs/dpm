# Sharing

A list owner publishes a list and others follow it with its share code. Followers can suggest
figures and changes, a list can be closed to members only, and it can be handed over to a new
owner. Sharing needs the app's cloud configuration; without it the app runs local-only and every
sharing control is hidden. Nobody needs an account.

## What the user can do

### Publishing (list owner)

- From the Lists screen, a list's ⋮ menu → _Share this list_ opens the sharing sheet. _Publish_
  gives the list an 8-character **share code**, shown with a QR code and a copy button.
- **Before the first share** the user agrees to the terms of use. They are asked again only
  when the terms change in a way that matters for what people share.
- Every edit to a published list is pushed in the background. A failed push never fails the
  local edit. The sheet then shows _Last sync failed · Retry_.
- The sheet shows how many phones follow the list (seen in the last 90 days). It is a rough
  figure.
- Suggestion and access settings appear only once the list is published. Changing one publishes
  at once.
- _Stop Sharing_ (⋮ menu, confirmed) removes the list and everything under it from the cloud.
  Followers' copies are detached: kept on their phone and made fully editable.

### What is published, and what never is

- Published: the list's name, types, dance, figures, modifiers, lane order and settings, and
  **link videos only**.
- Never published: videos stored on the phone, transcripts, the network view's manual
  arrangement, the date a figure was added and the owner's secret share key.
- A local video reaches followers only after _Put online_ turns it into a link
  ([video tools](video-tools.md)).

### Following (subscriber)

- _Subscribe to Shared List_ on the Lists screen takes a typed code or a scanned QR code. The
  copy is **read-only** and stays in sync while the list is open.
- Following an open list never signs the phone in.
- A subscribed list's ⋮ menu offers _Unsubscribe from List_ (the copy is removed; the code works
  again later) and _Report list_.
- Subscribing to one's own list, or to a list already followed, is refused with a reason.

### Suggestions

- The owner can **let subscribers suggest figures**, with a daily limit counted per subscriber or
  for the whole list. The limit resets at midnight UTC.
- **Also changes to existing figures** is a second switch. A suggested change costs one
  suggestion from the same limit.
- A subscriber sees _Suggest a figure_ in the List tab's header, and _Suggest a change_ in place
  of Edit on each figure (also in the Map's details). The form says how many suggestions are left
  today. A name is optional and remembered. Only video links are sent; phone videos stay behind.
  Agreeing to the terms comes first.
- A refused suggestion says why: the owner muted the sender, the day's limit is used up, or the
  list stopped taking suggestions.
- The owner's List tab header shows a lightbulb with the number waiting.
  - A **new figure** opens in the figure form, so the owner can correct it before _Add to list_.
  - A **change** is shown as one line per change (name, type, counts and rhythm, each tag,
    prerequisite, video and modifier). Lines the figure already has are left out. A line the
    owner has since changed differently starts unticked. _Apply selected_, _Edit, then apply_ or
    _Reject_. A change to a figure that no longer exists can only be dismissed.
  - Any suggestion can be dismissed. **Mute** stops a sender; muted senders are listed and can
    be unmuted.
- Subscribers see the list owner's level names. A suggested change to a level the list doesn't
  have is left out.
- A suggestion is treated as untrusted: anything that refers to types, figures or modifiers the
  list doesn't have is dropped, and only link videos are kept.

### Members-only lists

- Under _Who can open it_, the owner can make a published list **members only**, after a warning
  that everyone subscribed so far loses access until let in again.
- Looking up a members-only code shows _This list is for members only_ with _Ask to join_ (an
  optional name). Asking is the one step that signs the phone in. There is no live wait: once let
  in, the subscriber looks the code up again.
- The owner's List tab header shows a people button with the number waiting. The members sheet
  lists those asking (_Let in_, _Decline_), members (_Remove_, confirmed) and those turned away
  (_Let in_).
- A removed member's copy stops updating, is kept and becomes editable. They cannot ask again
  unless let in. Video links they have already seen keep working.
- This keeps strangers with the code out. It does not stop a member from forwarding a link.

### Handing a list over

- A list's ⋮ menu → _Hand over_ gives the owner a 10-character **handover code** (and a QR
  code), valid once, for 7 days. _Withdraw the code_ cancels it.
- The new owner must already follow the list. In its ⋮ menu they choose _Take over this list_
  and enter the code. They become the owner, the share code stays the same, and every follower
  keeps following.
- The old owner's copy becomes a read-only follower's copy, with a _List handed over_ notice, the
  next time that list is open on their phone.
- Videos only on the old owner's phone, transcripts and the manual arrangement do not move.
  Suggestions, mutes and members stay with the list.

### Owning a list across phones

- An editable export carries the list's secret share key, so importing it on a new phone (or
  after a reinstall) keeps control of the published list. A read-only export does not carry it.

### Reports and terms

- _Report list_ on a subscribed list takes a reason (no consent, endangers a child, copyright,
  hateful or illegal, spam, other), optional details and an optional email for a reply. Its buttons stay pinned below the form, as do the sharing sheet's. Sending
  again replaces the earlier report. The owner is never told who reported.
- Settings → Legal links to the terms of use and the privacy policy on the website.
- The operator reviews reports and removes content with tools outside the app
  (`tools/data-removal`, `tools/dashboard`). A list removed by the operator cannot be re-published
  by its owner's next edit. A blocked phone cannot publish, suggest, ask to join or take over.

## Rules that must always hold

| Rule                                                                                 | Guarded by                                                       |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| Only the owner on record can change or delete a published list                       | `__tests__/rules/firestore.rules.test.ts`                        |
| The share key is never in a published document                                       | `__tests__/rules/firestore.rules.test.ts`, `shareKey.test.ts`    |
| Local videos, transcripts and the date a figure was added are never published        | `__tests__/unit/publishedContent.test.ts`                        |
| The daily suggestion limit is enforced by the rules, not the app                     | `__tests__/rules/firestore.rules.test.ts` ("suggesting")         |
| A members-only list is readable only by members and the owner                        | `__tests__/rules/firestore.rules.test.ts` ("members-only lists") |
| A handover code works once, within 7 days, and moves the key                         | `__tests__/rules/firestore.rules.test.ts` ("handing over")       |
| A list taken down by the operator cannot come back                                   | `__tests__/rules/firestore.rules.test.ts`                        |
| Nobody, the owner included, can read a report                                        | `__tests__/rules/firestore.rules.test.ts`                        |
| A follower's copy that loses access is kept and made editable                        | `__tests__/components/MembersOnly.test.tsx`                      |
| Suggested changes skip what the figure already has and untick what the owner changed | `__tests__/unit/figureEdits.test.ts`                             |
| Sharing is refused until the terms are agreed                                        | `__tests__/components/TermsConsent.test.tsx`                     |

## Not built yet

- Feature requests and votes across the app ([#137](https://github.com/OliverHenrichs/dpm/issues/137)).
- Remembering a pending join request and adding the list on its own once accepted
  ([#139](https://github.com/OliverHenrichs/dpm/issues/139)).
- Reporting a single suggestion.
- Videos hosted by DPM itself (idea, [#143](https://github.com/OliverHenrichs/dpm/issues/143)), and links that don't play when forwarded
  (idea, [#144](https://github.com/OliverHenrichs/dpm/issues/144)).

## Code

`src/firebase/AGENTS.md`, `src/pattern/suggestions/AGENTS.md`, `src/pattern/members/AGENTS.md`,
`src/pattern/handover/AGENTS.md`, `src/legal/AGENTS.md`; the rules in `firestore.rules`; operator
tools in `tools/data-removal/README.md` and `tools/dashboard/README.md`.

## Decisions

- [0002](../decisions/0002-anonymous-sign-in-and-owner-records.md) Anonymous sign-in and owner records
- [0006](../decisions/0006-handover-keeps-the-share-code.md) Handover keeps the share code
- [0007](../decisions/0007-members-only-through-subscriber-records.md) Members-only lists
- [0003](../decisions/0003-dpm-uploads-no-video.md) DPM uploads no video
