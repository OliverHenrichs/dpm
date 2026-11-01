# Video tools

Tools for a figure's videos that run **on the phone**: shorten a clip, anonymize the dancers,
transcribe what the teacher says, and draft a name and description from that. A last tool, _Put
online_, gets a phone video onto YouTube or Vimeo through the user's own apps and brings back the
link. The on-device tools are Android only for now. No video, audio or transcript is uploaded by
these tools.

## What the user can do

### Edit video

- Edit Figure → Videos → **Edit video** on a phone video opens a sheet with three tabs:
  _Shorten_, _Anonymize_ and _Speech_. Online videos can't be edited.
- **Shorten** keeps the part chosen on a trim bar, sound included.
- **Anonymize** turns up to 30 seconds into a video that hides who the dancers are. It is marked
  _Experimental_: slow on older phones, and tracking can lose a dancer.
  - _Who to hide_: one dancer or a couple. The user taps each dancer on the first frame, and the
    app outlines who it picked so a wrong tap can be redone.
  - _How to hide them_: **Silhouettes** (the default; each dancer a coloured shape, nothing of
    the footage kept) or **Faces only** (the dancers as filmed, faces covered, the room blurred).
    Switching keeps the taps.
  - _Preview the first half second_ renders a short slowed-down sample before the full run.
  - The result has no sound and carries an _Anonymized_ badge.
- Before a cut, a switch offers to **transcribe the whole video first**, since the cut, or the
  silent anonymized result, loses what was said.
- After saving a new figure from a video, the app offers to edit it right away.

### Jobs and review

- Every tool runs as a **background job, one at a time**. A banner on the List tab reports each
  job, and a line opens its figure. Queued jobs and running transcriptions can be cancelled; a
  running cut cannot.
- The user may switch apps. A phone notification says when a batch finishes. Closing DPM, or
  Android killing it, loses the running job and leaves the original untouched.
- **A cut changes nothing until the user decides**: _Replace the original_, _Keep both_ (only
  while the figure has room under its 10 videos), _Discard_ or _Decide later_. When replacing would
  drop transcript lines, a switch (on by default) adds the whole transcript to the description.
- The original file stays on the phone whatever the user picks.

### Transcripts

- **Transcribe speech** writes down what is said, with Whisper on the phone, after a one-time
  download of the speech model (about 61 MB). An optional _accurate_ model is better with
  accents and dance terms, but slower.
- The language is detected. _Wrong language?_ runs it again in one of the app's nine languages.
- It listens for the list's own words (figure names, modifiers, tags, the dance's terms), so it
  hears "sugar push", not "sugar bush".
- The transcript shows timestamped lines. Tap a line to play from there. Tick lines to copy them
  word for word into the description. Correct a line by editing it; leave it empty to remove it.
- **Corrections are learned per list**: a fixed word is fixed in later transcripts of that list
  too. _Transcribe again_ replaces the corrections made to that video.
- Shortening a video keeps only the transcript lines inside the cut.
- Transcripts are never published. They leave the phone in an export only when the user opts in.

### Suggested name and description

- From a transcript, **Suggest name and description with AI** drafts both with a small language
  model on the phone (about 1.3 GB, downloaded once; Wi-Fi recommended). It is offered only on
  phones with at least 6 GB of memory.
- The sheet says it is AI and that ticking lines is the word-for-word alternative. The user can
  leave while it writes; the suggestion waits under the figure's videos and on the banner.
- Nothing changes until _Use suggestion_. Even then the name is filled only when empty, and the
  description gets a paragraph of its own. A video that doesn't seem to teach a figure gets no
  suggestion.

### Put online

- A phone video's tile offers **Put online**. _Share video_ opens the system share menu, where the
  user uploads it with their own app. Then they share the link back to DPM, or copy it and tap
  _Paste copied link_. The sheet gives steps for YouTube, Vimeo and Google Drive, and recommends
  Unlisted (or a Vimeo password).
- The link **takes the video's place in the figure and keeps its transcript and anonymized mark**.
  The file stays on the phone. A published list is pushed at once.
- DPM plays YouTube and Vimeo links and direct links to a video file or stream. Dropbox share
  links are rewritten to play. A link that won't play in DPM (a Drive page, say) needs a second
  tap to use anyway. Vimeo links keep their privacy hash, so unlisted videos play.
- Not offered for a universal modifier's videos yet.

### Shared into DPM (Android)

- Another app can share a video or a link to DPM. If a video is waiting for its link, DPM offers
  the link for it. Otherwise it offers to add the video to a figure of the open list or start a
  new figure with it. The open list must be the user's own.

### Models

- Settings → **On-device models** lists the speech and suggestion models with their size, and
  downloads or deletes them. Downloads are checked against a fixed hash.

## Rules that must always hold

| Rule                                                                         | Guarded by                                              |
| ---------------------------------------------------------------------------- | ------------------------------------------------------- |
| One heavy job at a time; nothing heavy runs beside a job                     | No test yet                                             |
| A cut result replaces nothing until the user keeps it                        | `__tests__/components/AnonymizeJobsContext.test.tsx`    |
| Keeping a result merges with edits made while the job ran                    | `__tests__/unit/videoUpdates.test.ts`                   |
| The selection stays within the tool's minimum and maximum length             | `__tests__/unit/trimWindow.test.ts`                     |
| Nothing from a suggestion is written without _Use suggestion_                | `__tests__/components/Suggestion.test.tsx`              |
| Only changed words are learned, not case, punctuation or added words         | `__tests__/unit/learnedCorrections.test.ts`             |
| A swapped-in link keeps the video's transcript and provenance                | `__tests__/unit/videoLinks.test.ts`                     |
| Which links play in DPM                                                      | `__tests__/unit/videoHosts.test.ts`                     |
| A corrupt or incomplete model download is never installed                    | `__tests__/components/modelStore.test.ts`               |

## Not built yet

- iOS: none of the on-device tools, and no share-in.
- Remote anonymize providers (planned with a consent step, never built).
- Put online for a universal modifier's videos.
- Figure recognition from a video (an idea in the project files: `ideas/figure-recognition.md`).

## Code

`src/anonymize/AGENTS.md` (jobs, review, Shorten, Anonymize), `src/transcribe/AGENTS.md`,
`src/suggest/AGENTS.md`, `src/videoLinks/AGENTS.md`, `modules/AGENTS.md` (the native side). The
design history and device measurements are in `docs/history/AGENT_TASKS.md` L3 and L4.

## Decisions

- [0003](../decisions/0003-dpm-uploads-no-video.md) DPM uploads no video; heavy work runs on the phone
- [0004](../decisions/0004-one-heavy-job-at-a-time.md) One heavy job at a time
