# docs/

How DancePatternMapper keeps its specification. Each kind of knowledge has one home, and each home
has one job.

| Where                    | What it holds                                                          | How it changes                                                        |
| ------------------------ | ---------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `AGENTS.md` (root)       | Orientation, the data model, rules that apply everywhere, an index     | Edited in place. Kept short: it is read on every agent turn           |
| `src/**/AGENTS.md`       | Rules and traps for the code in that directory                         | Edited in place, in the PR that changes the rule                      |
| `docs/product/`          | What the app does for the user, one living spec per feature area       | Rewritten to match the app, in the PR that changes behaviour          |
| `docs/decisions/`        | Why: one short record per decision that had real alternatives          | Append-only. A changed mind is a new record that supersedes the old   |
| `docs/plans/`            | Designs for work in flight, one file per feature                       | Folded into `docs/product/` (and decisions) and deleted on merge      |
| `docs/history/`          | Frozen material, kept because code comments cite it                    | Never edited                                                          |
| GitHub Issues            | The backlog: ideas, tester findings, known bugs                        | Closed by the PR that says `Closes #n`                                |

The decision behind this layout is [0001](decisions/0001-living-specs-and-decision-records.md); all records are listed in [`decisions/README.md`](decisions/README.md).

## The rules, in every PR

- **Behaviour changed** (anything a user could notice): update the matching `docs/product/` file
  in the same PR.
- **A choice with real alternatives was made**: add a decision record, or supersede an old one.
- **A plan in `docs/plans/` is done**: fold what was built into the spec, keep the reasons as
  decision records, and delete the plan file.
- **A new rule or trap for the code**: it goes in the nearest `AGENTS.md`, not in a spec.

`.github/pull_request_template.md` repeats these as a checklist.

## Product specs

One file per feature area (`docs/product/README.md` lists them), written as behaviour a tester
could check, under about 15 KB each. Every file has the same parts:

1. **What the user can do**: short rules, such as "When the list owner stops sharing, each
   subscriber's copy is detached and becomes fully editable." No code paths.
2. **Rules that must always hold**: invariants, each with the test that guards it.
3. **Not built yet**: known limits, so a gap is not mistaken for a bug.
4. **Code**: links to the `AGENTS.md` files for the area.
5. **Decisions**: links to the records behind it.

User-facing words follow the app: _figure_ on screen (`pattern` in code), _list owner_ for the
person who shares a list.

## Decision records

`docs/decisions/NNNN-short-title.md`, numbered in order, copied from
[`TEMPLATE.md`](decisions/TEMPLATE.md). Half a page: context, decision, alternatives, consequences.
An agent may draft one, but the reasons come from the person who decided; a guessed reason is
worse than none.

## Plans

`docs/plans/<feature>.md` for a design big enough to need a page (a small change needs only its
issue and PR). It names its issue and PR, and it is deleted when the work merges.
