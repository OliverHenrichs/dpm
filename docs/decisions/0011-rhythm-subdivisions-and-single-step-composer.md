# 0011: Rhythms take & and a after any beat, and the composer adds one element a tap

- **Status:** accepted
- **Date:** 2026-11-02
- **Decided by:** Oliver (the notation and the composer); the agent that built it (one spelling
  for a step on a subdivision, below)
- **Recorded from:** Oliver's decision of 2026-11-02, passed to the building thread

## Context

The notation only took triples and rolling counts (`3&4`, `3a4`, `3&4&5`). Some dances use very
quick steps, such as `3&a4`, that it could not write. The composer's pills added whole triples,
so it could not build them either.

## Decision

- After any beat number, `&` and then `a` may follow, each at most once, before the next beat.
  Any single beat or subdivision can be held: `(4)`, `3(&)4`, `3&(4)`. Counts stay the whole
  beats spanned, so a rhythm still always matches its counts. Slows and quicks are unchanged.
- No `e`, for now.
- A rhythm may open on a pickup before beat 1: `&1`, `a1`, `&a1` (Oliver, after trying it on the
  phone). Those steps belong to the bar before, so they add no count.
- The composer's pills add one element each: the next beat, `&`, `a`, with a one-shot pause
  toggle. Oliver found "Hold" odd and suggested a pause sign alone, pinned to the right so it
  stays put while the pills change.
- Only the last token may end on a subdivision (`1 2 3&`); elsewhere a subdivision chains on to
  the next beat (`3&4`, never `3& 4`), so every rhythm has one spelling. This part was the
  building agent's choice, since Oliver asked only that there be one spelling.

## Alternatives considered

- **`e` as a subdivision too** (`1e&a`): decided against for now.
- **Accepting `3& 4` and rewriting it to `3&4`**: two spellings to read for one rhythm; the form
  explains the chained one instead.

## Consequences

Every rhythm written before stays valid with the same counts and spelling, so the export format
did not change. Rhythm is still a string bounded only by length in the Firestore rules.
