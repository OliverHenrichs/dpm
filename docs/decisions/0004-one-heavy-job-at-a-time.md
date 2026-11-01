# 0004: Heavy video work runs one job at a time, outside React

- **Status:** accepted
- **Date:** recorded 2026-11-01
- **Decided by:** Oliver merged the PRs that built it
- **Recorded from:** `src/anonymize/AGENTS.md` ("The job queue"), `docs/history/AGENT_TASKS.md` L3

## Context

Shorten, anonymize, transcription and suggestions each load a large native model (EdgeTAM,
Whisper about 250 MB, the language model about 3.4 GB at peak). On a device test Android
destroyed and recreated the activity in the middle of a run.

## Decision

- One queue, `jobStore`, a module-level store rather than React state, runs one job at a time.
  Anything else heavy waits for it (`runExclusive`).
- A job finds its video by its file path, so it works on a figure not saved yet.
- A finished cut waits for the user's review before it replaces anything.

## Alternatives considered

- **Jobs in component state**: they vanished with the old tree while the native run carried on,
  and would have written a stale figure back.
- **Running jobs in parallel**: the phone cannot hold two of the models at once.

## Consequences

- Long queues are slow, but never crash for lack of memory.
- A job lives only as long as the app's process; if Android kills it, the original stays untouched.
- Every new heavy task goes through the queue.
