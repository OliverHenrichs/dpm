# 0008: Members-only lists keep strangers with the code out, nothing more

- **Status:** accepted
- **Date:** 2026-10-17
- **Decided by:** Oliver
- **PR:** #89
- **Recorded from:** `src/pattern/members/AGENTS.md`, `ideas/private-video-hosts.md` in the project files (phase 2)

## Context

Anyone with a share code could read a published list and every video link in it. Teachers sharing
footage of students need to limit that.

## Decision

- A published list can be members only. Its document is then readable only by members and the
  owner, enforced by the rules.
- A stranger with the code can only ask to join. The owner lets in, declines or removes.
- Membership lives in the same per-subscriber record as suggestion mutes.
- Following an open list still never signs in; only _Ask to join_ does.

## Alternatives considered

- **Private links at the host only** (Unlisted, a Vimeo password; phase 1 of the plan, built):
  limits who finds a video, not who reads the list and its links.
- **Signed, expiring video links** (phase 3): needs a server and paid hosting; not built.
- **A separate member roster**: the subscriber records that suggestion mutes already used give
  every subscriber an id, so membership reuses them rather than inventing a second list.

## Consequences

- It doesn't stop a member from forwarding a video link; the app says so.
- Making a list members only shuts out everyone subscribed so far until let in, so it asks first.
