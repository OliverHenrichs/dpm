# 0001: Keep the spec as living product specs plus decision records

- **Status:** accepted
- **Date:** 2026-11-01
- **Decided by:** Oliver
- **PR:** the one that adds this file

## Context

`AGENT_TASKS.md` began as a triage of the original idea list and grew into a 196 KB mix of
backlog, design writeups, device test logs and status. It stopped being updated around
2026-10-18, so none of the roughly 50 PRs after #72 are in it. The nested `AGENTS.md` files stayed
current because every PR touches them, but they describe how the code works, not what the app does
for the user or why. That knowledge ended up spread over the README (out of date), design docs
outside the repo, and project memory (over its size limit).

## Decision

- `docs/product/`: one living spec per feature area, rewritten to match the app in the PR that
  changes behaviour.
- `docs/decisions/`: short, numbered, append-only decision records.
- `docs/plans/`: designs for work in flight, folded into the specs and deleted on merge.
- `AGENT_TASKS.md` moves to `docs/history/` and is frozen.
- The backlog moves to GitHub Issues.
- Plain Markdown, no tool. A PR checklist keeps it current, and a CI check will enforce links and
  size budgets.

## Alternatives considered

- **OpenSpec, with its CLI and change folders**: the same shape with more process per change, and
  its sync step is the part that users report drifting anyway.
- **Minimal cleanup** (freeze `AGENT_TASKS.md`, refresh the README): cheap, but leaves nothing that
  stops the drift from happening again.

## Consequences

- A behaviour change without a spec change is visible in review.
- Project memory can shrink to facts that have no home in the repo.
- Writing the first specs and back-filling the main decisions is a one-off cost, done in a few
  PRs after this one.
