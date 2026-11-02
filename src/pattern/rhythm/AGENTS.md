# Rhythm — `src/pattern/rhythm/`

A pattern's optional `rhythm` (`IPattern.rhythm`), written the way dancers count it. `rhythm.ts` is
pure and fully unit-tested (`__tests__/unit/rhythm.test.ts`).

## Notation

One token per step, separated by spaces; beats run from 1 without gaps, so a rhythm says how many
counts it takes.

| Token            | Meaning                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------- |
| `3`              | a step on beat 3                                                                            |
| `3&4` or `3a4`   | a triple: three steps over beats 3 and 4 (`a` is a swung triple)                            |
| `3&4&5`, `5a6a7` | a rolling count: any number of consecutive beats chained with `&` or `a`, each counted once |
| `(4)`            | beat 4 without a weight change: a tap or a pause, as on 4 and 8 in salsa and bachata        |

| `S`, `Q` | a slow (two counts) and a quick (one): `S Q Q`, four counts. Never mixed with beat numbers |

Rolling counts came from review 2 (the Telemark, `1 2 3&4&5 6`, six counts). No template uses
one: its count was the tester's, not a verified syllabus.

`rhythmCounts` returns the counts or `null` when the text is not a rhythm; `normalizeRhythm` tidies
spacing and capitalises `s`/`q`, so equal rhythms compare equal. `rhythmProblem` says why text is
not one (`mixed`, `slowQuickJoin`, `invalid`), for the form's explanation.

**Slows and quicks** (#135) are read from what is typed, with no setting. Counts are in quicks
(S = 2, Q = 1), so the counts rule below holds unchanged. No `&` or `a` between them (`Q&Q` is
unverified), and no dance has an S/Q basic rhythm. Tango (an open question): counts stay in
quicks and are still shown.

## A rhythm always matches its counts

Both ways, in `EditPatternForm` through `withTimingCounts` / `withTimingRhythm`: typing a valid
rhythm sets `counts`, and changing `counts` drops a rhythm that no longer fits. The same holds for
a variant's own `counts` and `rhythm` (`IPatternModifierRef`, #134; attached modifiers only), where
no counts means the variant follows its figure (`variantTiming`). Text that is not yet a rhythm stays in the field with an explanation and
is not saved. Import enforces the same (`importWarnRhythmMismatch`); a stored rhythm that does not
match its counts is a bug.

## Composing a rhythm

`RhythmComposer` (`src/pattern/list/`) is the field with its bubbles, for a figure and a variant.
`nextRhythmSteps` offers the next token to append (a step, a triple, a swung triple, a held
beat), with an _Undo_ bubble (`removeLastRhythmStep`) that takes the last token off again, so a
mistap is fixed without the keyboard. After a chain (`3&4`), `nextChainLink` offers one more
bubble that rolls it on by a beat (`&5`, in the last link's own `&` or `a`); _Undo_ then takes
that link off first (`3&4&5` → `3&4`), so it reverses exactly one tap. `slowQuickSteps` offers
`S` and `Q` while the field is empty and after slows and quicks; beat bubbles never follow them. While the field is empty, the form offers the list's dance's
basic rhythms for the counts (`basicRhythms`), one tap each, and nothing else: no step on every beat.
They were taken out on 2026-10-11 as confusing and brought back on 2026-10-18 after a tester asked
for them, now that the rhythm section is folded by default. Templates give their starter patterns the dance's basic rhythm (`defaultRhythm`, from
`DANCE_RHYTHMS`; the dance is `IPatternList.dance`, `src/pattern/types/Dance.ts`).

**Only add a dance's rhythm when it is the standard one**, verified, not guessed. Argentine tango
deliberately has none. A new dance goes in `DANCES`, `DANCE_NAME_KEYS` (and its locale keys), and
the template list if it has one.
