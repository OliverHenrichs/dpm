# Rhythm — `src/pattern/rhythm/`

A pattern's optional `rhythm` (`IPattern.rhythm`), written the way dancers count it. `rhythm.ts` is
pure and fully unit-tested (`__tests__/unit/rhythm.test.ts`).

## Notation

One token per step, separated by spaces; beats run from 1 without gaps, so a rhythm says how many
counts it takes.

| Token | Meaning |
|---|---|
| `3` | a step on beat 3 |
| `3&4` or `3a4` | a triple: three steps over beats 3 and 4 (`a` is a swung triple) |
| `(4)` | beat 4 without a weight change: a tap or a pause, as on 4 and 8 in salsa and bachata |

`rhythmCounts` returns the counts or `null` when the text is not a rhythm; `normalizeRhythm` tidies
spacing so equal rhythms compare equal.

## A rhythm always matches its counts

Both ways, in `EditPatternForm`: typing a valid rhythm sets `counts`, and changing `counts` drops a
rhythm that no longer fits. Text that is not yet a rhythm stays in the field with an explanation and
is not saved. Import enforces the same (`importWarnRhythmMismatch`); a stored rhythm that does not
match its counts is a bug.

## Suggestions

While the field is empty, `rhythmSuggestions` offers whole rhythms: the list's `dance`'s basic
rhythms for those counts (`DANCE_RHYTHMS`; the dance is `IPatternList.dance`,
`src/pattern/types/Dance.ts`), then a step on every beat. Below them `nextRhythmSteps` offers the next token to append (a step, a triple, a swung
triple, a held beat), with an *Undo* bubble (`removeLastRhythmStep`) that takes the last token
off again, so a mistap is fixed without the keyboard. Templates give their starter patterns the dance's basic rhythm (`defaultRhythm`).

**Only add a dance's rhythm when it is the standard one**, verified, not guessed. Argentine tango
deliberately has none. A new dance goes in `DANCES`, `DANCE_NAME_KEYS` (and its locale keys), and
the template list if it has one.
