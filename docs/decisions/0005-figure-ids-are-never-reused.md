# 0005: Figure ids are never reused

- **Status:** accepted
- **Date:** recorded 2026-11-01
- **Decided by:** Oliver merged the fix (B14)
- **Recorded from:** `docs/history/AGENT_TASKS.md` B14, `src/pattern/data/AGENTS.md`

## Context

Ids used to be the highest id plus one, so deleting the newest figure and adding another reused its
id. The network view's manual layout is stored by id and outlives figures, so the new figure
appeared where the deleted one had sat.

## Decision

Each list keeps a high-water mark, `nextPatternId`, and `nextPatternId(list, patterns)` is the only
way to mint an id. The allocator also takes the highest id plus one, so a missing or corrupt mark
cannot collide.

## Alternatives considered

- **Keep reusing ids and prune stale positions**: leaves a window (a delete and an add before the
  Map next resolves its layout) in which a stranger's position is inherited. Pruning stays as
  housekeeping only.

## Consequences

- No migration was needed.
- Anything stored by figure id may rely on ids being unique over time.
