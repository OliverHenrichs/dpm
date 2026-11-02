# Rhythm — `src/pattern/rhythm/`

A pattern's optional `rhythm` (`IPattern.rhythm`), written the way dancers count it. `rhythm.ts` is
pure and fully unit-tested (`__tests__/unit/rhythm.test.ts`).

## Notation

Tokens separated by spaces; beats run from 1 without gaps, so a rhythm says how many counts it
takes: its last beat number.

| Written                 | Meaning                                                                                  |
| ----------------------- | ---------------------------------------------------------------------------------------- |
| `3`                     | a step on beat 3                                                                         |
| `3&4`, `3a4`, `3&a4`    | after a beat, `&` (half) then `a` (late offbeat), each once, chained on to the next beat |
| `3&4&5`, `5a6a7`        | a rolling count: any number of beats chained, each counted once                          |
| `1 2 3&`                | only the last token may end on a subdivision; elsewhere it chains (`3&4`, never `3& 4`)  |
| `(4)`, `3(&)4`, `3&(4)` | any single beat or subdivision held: no weight change, a tap or a pause                  |
| `S`, `Q`                | a slow (two counts) and a quick (one): `S Q Q`, four counts. Never mixed with numbers    |

No `e` (Oliver, 2026-11-02; [0011](../../../docs/decisions/0011-rhythm-subdivisions-and-single-step-composer.md)).
The chaining rule gives every rhythm one spelling, which `normalizeRhythm` writes. A rhythm is
read into `RhythmElement`s (`rhythmElements`, null when it is not one) and written back from them.

Rolling counts came from review 2 (the Telemark, `1 2 3&4&5 6`, six counts). No template uses
one: its count was the tester's, not a verified syllabus.

`rhythmCounts` returns the counts or `null` when the text is not a rhythm; `normalizeRhythm` writes
the one spelling (and capitalises `s`/`q`), so equal rhythms compare equal. `rhythmProblem` says
why text is not one (`mixed`, `slowQuickJoin`, `markOrder`, `markSplit`, `invalid`), for the form.

**Slows and quicks** (#135) are read from what is typed, with no setting. Counts are in quicks
(S = 2, Q = 1), so the counts rule below holds unchanged. No `&` or `a` between them (`Q&Q` is
unverified), and no dance has an S/Q basic rhythm. Tango (an open question): counts stay in
quicks and are still shown.

## A rhythm always matches its counts

Both ways, in `EditPatternForm` through `withTimingCounts` / `withTimingRhythm`: typing a valid
rhythm sets `counts`, and changing `counts` drops a rhythm that no longer fits. The same holds for
a variant's own (`IVariantOverrides`, #134), where counts and rhythm are overridden together and
no counts means the variant follows its figure (`effectiveVariant`). Text that is not yet a rhythm stays in the field with an explanation and
is not saved. Import enforces the same (`importWarnRhythmMismatch`); a stored rhythm that does not
match its counts is a bug.

## Composing a rhythm

`RhythmComposer` (`src/pattern/list/`) is the field with its bubbles, for a figure and a variant.
`nextRhythmElements` offers one element to append (the next beat, `&` after a beat, `a` after a
beat or its `&`), added by `appendRhythmElement` in the one spelling. _Hold_ is one-shot, like
a shift key: the next element tapped goes in held, then it turns off (no lock). _Undo_
(`removeLastRhythmStep`) takes off exactly one element (`3&a4` → `3&a`), or a word of text that
is not a rhythm yet. `slowQuickSteps` offers `S` and `Q` while the field is empty and after slows
and quicks; beat bubbles and _Hold_ never follow them. While the field is empty, the form offers the list's dance's
basic rhythms for the counts (`basicRhythms`), one tap each, and nothing else: no step on every beat.
They were taken out on 2026-10-11 as confusing and brought back on 2026-10-18 after a tester asked
for them, now that the rhythm section is folded by default. Templates give their starter patterns the dance's basic rhythm (`defaultRhythm`, from
`DANCE_RHYTHMS`; the dance is `IPatternList.dance`, `src/pattern/types/Dance.ts`).

**Only add a dance's rhythm when it is the standard one**, verified, not guessed. Argentine tango
deliberately has none. A new dance goes in `DANCES`, `DANCE_NAME_KEYS` (and its locale keys), and
the template list if it has one.
