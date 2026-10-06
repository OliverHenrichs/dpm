# Video jobs, Shorten and Anonymize — `src/anonymize/`

The on-device video tools' shared machinery: the job queue every heavy task runs through, the
review step, and the two video edits (*Shorten*, *Anonymize* into a silhouette). Android only for
now. Transcription is in `src/transcribe/`, suggestions in `src/suggest/`, the native side in
`modules/`. Design history and device measurements: `AGENT_TASKS.md` L3 (and L4 for speech).
Unqualified paths are relative to `src/anonymize/`.

## Where the user meets it

- Edit Pattern → Videos → **Edit video** (`components/VideoEditPanel.tsx`, in `AnonymizeModal`):
  one tab per job, *Shorten*, *Anonymize* and *Speech* (`TranscribeSection`). The cut tabs pick
  the part to keep on a trim bar (`TrimWindowBar`, `model/trimWindow.ts`); *Anonymize* then has the
  user tap each dancer on the first frame (`model/promptPoints.ts`). Each tab says what it does and
  ends in one button naming the result ("Shorten to 18 s"); options that change the job are
  `SwitchRow`s above that button, never chips. A disabled button says why under it. Before a cut
  a switch offers to transcribe the whole video first, queued ahead of the cut.
- The pattern list's **+** → *From a video* / *Record a video* seeds a new pattern, then offers
  Edit video after saving.
- `components/AnonymizeJobsBanner.tsx` on the pattern list reports every job; a line opens its
  pattern when it is in the active list. Queued jobs and running transcriptions can be cancelled;
  a running shorten or anonymize cannot (the native pipeline has no stop).
- `components/VideoReviewModal.tsx` shows a finished cut for review.

## The job queue (`jobs/jobStore.ts`)

**A module-level store, not React state, on purpose.** Android destroyed and recreated the activity
mid-run in the same process: jobs held in component state vanished with the old tree while the
native run carried on, and would have written that tree's stale pattern back.

- `JobKind = "anonymize" | "shorten" | "transcribe"`;
  `JobStatus = "queued" | "running" | "review" | "done" | "failed"`.
- **One job at a time.** The phone cannot hold two models (Whisper, EdgeTAM, the LLM) at once.
  Anything else heavy goes through `jobStore.runExclusive`, which waits for everything queued
  before it. The one exception: a transcription asked to go on and suggest calls `runSuggestion`
  inside its own turn.
- **A job finds its video by URI**, across the list, so it works for a pattern not yet saved.
- Failures the user can act on carry an `errorKey` (an i18n key) shown instead of exception text.
- `jobs/AnonymizeJobsContext.tsx` (`AnonymizeJobsProvider`, in the root layout) exposes the store to
  React through `useSyncExternalStore`, keeps the screen awake while jobs run, registers the attach
  handler, and posts one phone notification when a batch finishes in the background
  (`jobs/jobNotifications.ts`; permission asked when a batch starts; listed in
  `PRIVACY_POLICY.md`). `expo-notifications` is required lazily there; keep it that way (root
  `AGENTS.md`).
- A job lives only as long as the process; if Android kills the app the job is lost and the
  original video is untouched.

## Review, then keep or discard

**A shortened or anonymized video changes nothing until the user decides.** It waits in `review`;
`jobStore.keep(id, "replace" | "both")` puts it in place of the original or beside it (only when the
group has room under `MAX_VIDEOS`), `jobStore.discard(id)` throws it away. A transcription finishes
straight onto its video; one that also suggested waits in `review` until `jobStore.settle(id)`.

Keeping goes through `jobs/replaceVideo.ts`:

- through the **mounted tree's attach handler** when the job's list is active, so the result merges
  with whatever the user edited meanwhile; otherwise **straight to storage**, since the user may have
  switched lists;
- `VideoUpdate` is a reference or a function of the current reference, so it keeps fields the job
  never saw, including on the copy in an open form's draft;
- `recordReplacement` + `applyReplacements` swap the new video into drafts saved later
  (`usePatternCrud` applies them on every save), so a form opened before the job finished cannot
  put the original back;
- **the new video carries only the transcript lines inside the cut, retimed** (`trimTranscript` in
  `src/pattern/data/transcripts.ts`). A video the app made carries `generated: { method,
  createdAt }`; a silhouette can only be shortened afterwards, and keeps its provenance.

## Shorten and Anonymize

- `shortenVideo.ts`: the same Media3 pass anonymization starts with (`mode: "passthrough"`,
  `height: 0` keeps the size), audio kept, no length cap. `canShortenVideos()` is
  `isAnonymizeAvailable`.
- **`runAnonymize.ts` is the only entry point for anonymization**, and enforces in code what the UI
  also checks: the trim is inside the provider's limits (`TrimOutOfLimitsError`), the prompts are
  there (`PromptsRequiredError`), and a provider that sends footage off the device has a recorded
  `Consent` (`ConsentRequiredError`). Never call a provider directly.
- **Providers are pluggable** (`providers/`): `AnonymizeProvider` declares limits, prompt counts,
  `sendsFootageOffDevice` and `isAvailable()`; `allProviders.ts` lists them, `registry.ts` filters
  to what runs here. The one shipped provider is `onDeviceTracking.ts` (EdgeTAM tracking from taps,
  1 to 30 s, one dancer or a couple). With one provider the editor shows no method picker. A
  remote provider would need the consent step, which does not exist yet.
- The dancer colours in the editor's markers must match what the pipeline paints; they are data,
  hence the lint disable comment.

## Gestures and layout in the editor

The editor is a React Native `Modal`, outside the drawer's gesture root: it mounts its own
`GestureHandlerRootView`, or the trim bar's pan never activates on Android. It is outside
`PageContainer`, so it pads by `SCREEN_EDGE_INSET` itself (`src/common/AGENTS.md`).

## Testing

Unit tests cover the pure parts (`trimWindow`, `promptPoints`, `runAnonymize`, `replaceVideo`,
`videoUpdates`). Under Jest the native module is absent, so the UI hides the actions unless a test
mocks `@/modules/video-anonymize`. Whether a job survives activity recreation, and how the pipeline
performs, are device checks (dev builds log each run's stats as `[anonymize]`).
