# 0002: Publishers sign in anonymously and own a list through a share key

- **Status:** accepted
- **Date:** 2026-10-04 (rules live); recorded 2026-11-01
- **Decided by:** Oliver
- **Recorded from:** `src/firebase/AGENTS.md`, project memory (2026-10-04)

## Context

Shared lists need an owner who alone may change them, but the app has no accounts and collects
no personal data. A plain anonymous id is lost on a reinstall or a new phone, which would lock the
publisher out of their own list.

## Decision

- Publishing signs in to Firebase anonymously. Following an open list never signs in.
- Each published list has an owner record, readable by nobody, holding the owner's id and the
  list's secret **share key**. Presenting the key moves ownership to the caller.
- The key lives only on the publisher's phone and in their editable exports, never in the
  published document. It changes only on a handover ([0006](0006-handover-keeps-the-share-code.md)).
- The Firestore rules, not the app, decide who may write.

## Alternatives considered

- **Accounts (email, Google sign-in)**: personal data, a sign-up step for dancers who only want
  their own list, and more to cover in the privacy policy.
- **Ownership by anonymous id alone**: lost on every reinstall or phone change.

## Consequences

- No personal data is needed to publish.
- Whoever holds an editable export can take over the list; that is the intended way to move phones.
- Every new write path must be checked in the rules, including `notBlocked()`.
