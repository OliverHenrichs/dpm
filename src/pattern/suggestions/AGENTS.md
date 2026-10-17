# Pattern suggestions — `src/pattern/suggestions/`

A publisher can let the subscribers of a shared list suggest new patterns, with a daily limit
counted for the whole list or per subscriber, and can mute a subscriber. Not to be confused with
`src/suggest/`, which suggests a name and description from a video's transcript.

## The setting

`IPatternList.suggestions?: { dailyLimit, per: "list" | "subscriber" }`. Absent means suggestions
are off; switching off **removes the key** (Firestore rejects `undefined`). It lives on the list,
so `publishList` publishes it and every subscriber's copy carries it through `useSharedList`: that
is how a subscriber's app knows whether to offer _Suggest a pattern_. It is set in
`ShareListModal` (a published list publishes the change at once; an unpublished one waits for
Publish) and travels in exports since format 3.6.

## Firestore (`src/firebase/PatternSuggestionService.ts`, `firestore.rules`)

Under `sharedLists/{code}`:

| Subcollection        | Doc id                           | Holds                                                      | Readable by                                        |
| -------------------- | -------------------------------- | ---------------------------------------------------------- | -------------------------------------------------- |
| `suggestions`        | auto                             | `{ authorUid, authorName?, pattern, createdAt, appToken }` | the owner                                          |
| `suggestionCounters` | `d<utcDay>` or `d<utcDay>_<uid>` | `{ count, last }`                                          | anyone signed in, one by one; the owner lists them |
| `subscribers`        | the subscriber's anonymous uid   | `{ status?: "muted", membership?, name?, updatedAt }`      | the owner, and that subscriber                     |

- **The daily limit is the rules', not the app's.** `submitSuggestion` writes the suggestion and
  today's counter in one transaction. The rules accept the suggestion only when the list's
  `suggestions` exists, the author is not muted, and the counter the policy names
  (`counterIdFor`, from the server's clock in UTC days) goes up by exactly one, names this
  suggestion as `last`, and stays within `dailyLimit`. A counter write needs a suggestion by the
  caller created in the same write, and only today's list counter or the caller's own may be
  touched, so nobody can use up tomorrow's limit or another subscriber's.
- **The days are UTC**, so the limit resets at midnight UTC, not at local midnight. A phone whose
  clock is off near midnight names the wrong counter and is refused; it can send again a moment
  later.
- **Subscribers sign in anonymously to suggest** (`ensureSignedIn`); the uid is the author id,
  what the per-subscriber limit counts and what a mute names. The optional name is free text the
  subscriber chooses, remembered in `@suggesterName`.
- **`subscribers/{uid}` is the publisher's record of a subscriber**, shared with members-only
  lists (`src/pattern/members/AGENTS.md`), which keep a `membership` next to the mute. Writes
  merge, and unmuting a member removes only `status`, so neither erases the other.
- **Ownership.** The owner reads, dismisses and mutes as the owner on record. After a reinstall or
  on a new phone that is a new anonymous id, so the service retries a refusal once after
  `confirmOwnership` (the owner record re-written with the share key).
- **Refusals say no, not why.** `submitSuggestion` asks again (`getSuggestionStanding`, and the
  list's current setting) to tell `muted`, `limit` and `closed` apart.
- `unpublishList` deletes all three subcollections first.

## The app

- `suggestions.ts` (pure): `canSuggestTo` (a subscribed copy that takes suggestions),
  `receivesSuggestions` (the publisher's own published list), `counterIdFor`, `suggestedPattern`
  (what is sent: URL videos only, no transcripts or `createdAt`, nothing `undefined`, within the
  rules' bounds) and `patternFromSuggestion`. **A suggestion is untrusted input**: another phone
  wrote it. `patternFromSuggestion` drops types, prerequisites and modifiers the list does not have
  (any more), keeps URL videos only and a rhythm only if it matches the counts, the same spirit as
  import validation.
- The List tab's header shows a lightbulb (`SuggestionsButton`): _Suggest a pattern_ on a
  subscribed list (`SuggestPatternModal`), or the review with a count on the publisher's own
  (`SuggestionsModal`, shown while suggestions are on or any are left). `useListSuggestions`
  listens while the publisher's list is published, whether or not suggestions are on now.
- Both modals render only while open (`src/pattern/list/AGENTS.md`, always-mounted modals), so
  every opening asks afresh how many suggestions are left.
- Both reuse `EditPatternForm` (`initialPattern`, `title`, `saveLabel`, `header`). Reviewing opens
  the form seeded with the suggestion so the publisher can correct it; _Add to list_ goes through
  `usePatternCrud.addPattern` (new id, `createdAt`, the sync) and then deletes the suggestion.
- Rules tests: `__tests__/rules/firestore.rules.test.ts` ("suggesting" and after). Component
  tests: `__tests__/components/PatternSuggestions.test.tsx`.
