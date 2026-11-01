# 0006: "Figure" on screen, `pattern` in code; the sharer is the "list owner"

- **Status:** accepted
- **Date:** 2026-10-25
- **Decided by:** Oliver
- **PR:** #117
- **Recorded from:** Project memory (website review 2026-10-25), root `AGENTS.md`

## Context

The website said "figure" in places and "pattern" in others, and called the person who shares a
list a "keeper" while the app said "publisher". Dancers say figure.

## Decision

- User-facing text says _figure_ (de _Figur_, es/pt _figura_, fr _figure_, ar حركة). Keys, types,
  ids and storage keep `pattern`, and so does the app's name.
- The person who shares a list is its _list owner_, in the app and on the website.

## Alternatives considered

- **Rename everything in code too**: a large churn through storage keys and the export format
  for no user benefit.
- **"Pattern" everywhere**: not the word dancers use.

## Consequences

- New user-facing text follows `docs/product/glossary.md`.
- Code and screen use different words; the glossary maps them.
