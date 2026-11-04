# Sequences — `src/pattern/sequences/`

Named runs of a list's figures in dancing order (#136): `IPatternList.sequences`, shown on the
List tab's third segment. What the user sees is `docs/product/sequences.md`; the design for the
phase still to come (the Map) is `docs/plans/sequences.md`.

- **Model** (`src/pattern/types/IPatternList.ts`): a sequence has an id, name, optional
  description, optional `video` (an `IVideoReference`), steps and `createdAt`; a step is
  `{ kind: "figure", id, patternId, modifierId?, note?, at? }` or
  `{ kind: "free", id, text, counts?, note?, at? }`. Step ids keep two steps of one figure apart when
  reordered. Optional fields are **absent, never `undefined` or empty** (the list is published as
  it is): `cleanSequence` makes a sequence so on save, `withSequences` drops the key with the last
  one.
- **Pure logic is `sequences.ts`**, shared by the UI, `usePatternCrud` and `normalizeList`:
  caps (`MAX_SEQUENCES` 50, `MAX_SEQUENCE_STEPS` 200, text lengths), `stepVariants` (attached,
  then universal, as `ModifierPillStrip`), `stepCounts` (via `effectiveVariant`, so a variant's
  own counts count), `sequenceTotals` (eights only for `EIGHT_COUNT_DANCES`), `freeStepsOf` and
  `withoutVariant` for deletes.
- **Counts are never stored on a figure step**: they come from the figure or variant, so a
  changed figure changes every total. A variant the figure no longer has (detached, or no longer
  universal) shows as the plain figure and is dropped on the next save.
- **Mutations go through `usePatternCrud`** (`saveSequence`, `deleteSequence`); `deletePattern`
  writes the list (free steps) before the patterns, and `deleteModifier` scrubs the variant.
  The caps are the app's: the security rules don't enforce them.
- **`SequenceModal` mounts its own `GestureHandlerRootView`**: the step grips are Gesture Handler
  pans, which never activate inside a `Modal` without one (`src/common/AGENTS.md`).
- **Drag reorder** (`useStepDrag.ts`): one pan per grip, activating at once (`minDistance(0)`).
  The rows don't reflow during a drag: the dragged row follows the finger as a transform and the
  rows it passes make way by its height, so no view moves under a gesture; React hears of it at
  pick-up (`holding`, which stops the form's scroller) and drop only. Row centres come from
  `onLayout` and are captured by each gesture as data, and the drop target is `laneIndexAt` (a
  worklet). **No arrow functions inside these worklets**: the React Compiler hoists them off the
  UI thread (`src/pattern/graph/AGENTS.md`). Jest drives the handlers through the mock
  (`sequences.test.tsx`); arbitration with the scroller is a device check.
- Long press on a step duplicates it, but only as a shortcut beside the copy button
  (`src/common/ui/AGENTS.md`).

## Video mapping

- **A step's `at` is a place in the sequence's video** (seconds, to the hundredth, `roundMark`).
  It exists only beside a video: `cleanSequence` drops the marks of a sequence without one, and
  wherever a video is left behind (an export without videos, publishing a local file, a shared
  list's local video, a video that cannot be restored on import) it goes through
  `withSequenceVideo`, which takes the marks with it. A duplicated step has no mark.
- **The sequence video travels as a figure's does**: embedded in a full export, a link
  otherwise, its transcript only on the export sheet's opt-in (`sequencesHaveTranscripts` offers
  it), never published (`publishedSequences`), web links only from the cloud.
- **One player interface, three players** (`sequencePlayer.ts`, `SequenceVideo.tsx`):
  `expo-video` for files and direct links, `react-native-youtube-iframe` for YouTube, Vimeo's
  embed (plays, no handle). `videoSeeks` says which can be marked. `SequenceYouTubePlayer` is a
  platform split: on web YouTube is a plain iframe without the time API, so it does not seek.
- **Time while playing, and only then.** `expo-video` reports `timeUpdate` every 0.25 s; its
  interval is switched off while paused (Android's clock ticks on otherwise). That switch is set
  by a listener added **inside `useVideoPlayer`'s setup**, on the player being made: the player
  the hook returns is immutable to the React Compiler (`react-hooks/immutability`), so seek with
  `seekBy`, never assign. YouTube is polled with `getCurrentTime()` every 250 ms while its state
  is _playing_. Both stop with the player on unmount.
- `useSequencePlayback` holds the time, the step playing (`stepAtTime`, a mark counts 0.1 s early
  since a seek lands near it) and _Loop step_ (`loopWindow`: back to the mark on reaching the next
  later one, or the end). `useFollowStep` keeps that step in view as the transcript sheet does
  (`src/transcribe/followScroll.ts`). **The scroller's ref is made by the component and passed
  in**: a hook returning an object with a ref in it makes `react-hooks/refs` flag every use of
  that object during render.
- **The figures' video tools** (`SequenceVideoTools`, under the form's video): the same
  `AnonymizeModal`, `VideoReviewModal`, `TranscriptSheet`, `PutOnlineSheet` and job lines
  (`DraftJobLines`) as `EditPatternForm`, with its gating. Jobs find the video by URI in the
  list's sequences too (`replaceVideoInSequence`, `src/anonymize/AGENTS.md`); the form takes a
  finished one through `applySequenceReplacements` on every job-store change, and
  `saveSequence` applies them again. **A cut moves the marks** (`marksAfterCut`: minus the cut's
  start, those outside it dropped); _Keep both_ is not offered, since a sequence holds one video.
  A mark session ends when the video is replaced.
- **Layout**: in the form the video, the _Mark steps_ row and the tools are one card framed like
  the form's card below it. The tools are one wrapping row of `secondary` `sm` buttons (_Edit
  video_, _Transcript_, _Put online_); an online video's _Edit video_ is disabled with an
  `InfoHint` under it; job cards follow. **The video frame is always 100% wide** and only its
  height is capped (`SEQUENCE_VIDEO_MAX_HEIGHT`): `aspectRatio` with `maxHeight` made Yoga shrink
  the width to the capped height, off centre. Embedded players get 16:9 of that height, centred.
- **Mark steps** (`SequenceForm`): `markQueue` (the unmarked steps, or all when every one is
  marked), started at `markStart` (0, or the last mark before the first one queued). A mark
  awaits the player's time, so it changes the draft functionally and a ref keeps a second tap
  from marking the same step. _Back_ restores what the step had before.
