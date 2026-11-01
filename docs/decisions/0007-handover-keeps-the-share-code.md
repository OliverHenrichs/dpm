# 0007: Handing a list over keeps its share code

- **Status:** accepted
- **Date:** 2026-10-18
- **Decided by:** Oliver
- **PR:** #96
- **Recorded from:** `src/pattern/handover/AGENTS.md`

## Context

A teacher leaving a course had no way to pass the list on. The only option was for the new teacher
to publish a copy, so every student had to subscribe again and two lists drifted apart.

## Decision

- The owner offers a one-time handover code, valid 7 days. Someone who already follows the list
  enters it and becomes the owner; the owner record gets a fresh share key.
- The share code stays, so every subscriber keeps following.
- The old owner's copy becomes a read-only follower's copy.

## Alternatives considered

- **Republish a copy**: what this replaces.
- **Pick the new owner from a roster**: open lists have no roster of subscribers, so the code is
  the secret.

## Consequences

- Phone-only videos, transcripts and the manual layout don't move, since none are published.
- The old owner learns of the handover only when that list is next open on their phone.
