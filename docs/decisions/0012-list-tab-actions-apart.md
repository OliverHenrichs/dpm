# 0012: The List tab keeps the list, its followers and its view apart

- **Status:** accepted
- **Date:** 2026-11-14
- **Decided by:** Oliver
- **PR:** see the PR that adds this record

## Context

On a published list the Figures header held up to six look-alike icons in one row: sort,
filter, list settings, members, suggestions and add. Three kinds of action (changing the list,
dealing with followers, changing the view) were mixed together and hard to tell apart. Modifiers
and Sequences had only a title and **+**, with no sort or filter.

## Decision

Each kind of action gets its own place, the same on every segment:

- Followers' actions move into a band above the segments that says what is waiting in words.
- List settings move beside the list's name in the header.
- The title row under the segments, which only repeated the segment's name, becomes the
  toolbar: labelled sort and filter chips on the left, **+** on the right.
- Modifiers and Sequences get sort and filter like Figures.

## Alternatives considered

- **Keep one icon row, ordered by kind with dividers**: the smallest change, but still six
  unlabelled icons on Figures.
- **A labelled view bar under each title**: clear, but an extra row on every segment, and the
  followers' pill only fit on Figures, so the segments still differed.

## Consequences

The followers' band costs a row on published lists, and owners find list settings in a new
place. In exchange every segment has the same toolbar, sort and filter say what is in force,
and what followers are waiting for is visible from any segment.
