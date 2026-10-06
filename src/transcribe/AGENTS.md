# Speech transcription — `src/transcribe/`

What a teacher says in a pattern's video, transcribed on the phone with Whisper (`whisper.rn`) and
stored on the video reference (`IVideoReference.transcript`). Android only for now: it needs
`modules/audio-extract`. Runs as a `"transcribe"` job in `jobStore` (`src/anonymize/AGENTS.md`).
Design history and device numbers: `AGENT_TASKS.md` L4. Unqualified paths are relative to
`src/transcribe/`.

## Pipeline (`transcribeVideo.ts`)

extract 16 kHz mono speech audio (`AudioExtractModule.extractSpeechWav`, capped at `maxSeconds`,
default 600) → voice-activity detection (Silero) → Whisper per speech region → segments.

- **VAD times are centiseconds**, whatever whisper.rn's README says (`speechRegions.ts`). Regions
  under 0.4 s are dropped, the rest padded by 0.25 s and joined across gaps up to 1.5 s.
- The language is detected on the first region and fixed for the rest; no speech at all gives an
  empty transcript in `"und"`. *Wrong language?* in the sheet re-runs with one of the app's nine.
- `segments.ts` drops annotations (`[MUSIC]`, `(laughs)`, `♪`) and splits lines longer than
  `MAX_SEGMENT_CHARS` at sentence ends, then commas, sharing time out by length.
- `vocabulary.ts` builds Whisper's prompt from the list's own words (pattern names first, then
  types, modifiers, tags) so it hears "sugar push", not "sugar bush". **Capped at 224 characters**:
  a longer prompt slowed decoding and merged segments.
- Returns `{ promise, stop }`; only transcription can be cancelled while running.
  `ModelsMissingError` and `NoAudioError` (a silhouette has no sound) are distinct, and surface as
  sentences through the job's `errorKey`.
- `whisper.ts` is the one importer of `whisper.rn`; `whisper.web.ts` stubs it for web, because the
  package reads its native module at import.
- The Whisper and VAD contexts stay loaded between transcriptions, but a shorten or anonymize job
  unloads them first (`releaseTranscriptionContexts`): Whisper holds ~250 MB of native memory the
  silhouette pipeline needs.

## Models (`models.ts`, `modelStore.ts`)

`modelStore.ts` is **the app's one download path for every model**, the suggestion model's too
(`src/suggest/`). Rules for any model added:

- Pinned URL, exact byte size and SHA-256 in a `ModelSpec`. Pin to a commit when the host allows
  it, so the file cannot change under its hash.
- Downloaded on first use into `<document>/models/`, through a `.part` file that is moved into
  place only when HTTP status, size and hash match. The hash comes from the native `sha256File` in
  `modules/audio-extract`, which is why model features need that module.
- **State the size before any download**, and only while the model is missing: Edit video names it
  under the button or switch that would fetch it ("Downloads 61 MB once."), so the tap itself is
  the consent and there is no second prompt. The download counts into the job's progress. The legacy `createDownloadResumable` is used because it reports progress.
- An installed model is checked by size on each use; the hash only at download.
- Settings → *On-device models* (`src/settings/components/DeviceModelsSection.tsx`) lists them,
  downloads ahead of first use, and deletes.

Today: Whisper base q5_1 (~60 MB) and Silero VAD v6.2.0 (0.9 MB).

## UI

- `components/TranscribeSection.tsx` is Edit video's *Speech* tab: *Transcribe speech* (with a
  `SwitchRow` to go on and suggest, where suggestions can run), then *Open transcript* /
  *Transcribe again*.
- `components/TranscriptSheet.tsx`: the video over timestamped lines; tapping a line seeks, the line
  being said is highlighted and followed (`followScroll.ts`, paused by a manual scroll). Ticked
  lines are copied word for word into the description as a paragraph of their own in spoken order
  (`excerpt.ts`). It hosts the suggestion panel (`src/suggest/`). Without the form's callbacks it
  is read-only: `PatternDetails` (list rows, the Map's details) opens it from *Show transcript*
  under the video carousel, pausing the carousel's player.
- `hooks/useStartTranscription.ts` starts a job with the active list's vocabulary, optionally going
  on to suggest.
- A transcribed video's thumbnail carries a badge that opens the transcript.

## Privacy

**Transcripts are private by default.** Nothing is written into a description without the user's
tap (*Add to description*). Transcripts never go into a published list (`withoutTranscripts`,
`src/pattern/data/transcripts.ts`) and leave in an export only on the export sheet's opt-in
(`src/pattern/data/AGENTS.md`). When a video is cut, only the lines inside the cut move to the new
video, retimed (`trimTranscript`).

## Testing

`whisper.rn` is mocked globally (`__mocks__/whisper.rn/`: a test decides what speech is detected and
what each call returns), and so is the legacy file system download. The pure parts
(`speechRegions`, `segments`, `vocabulary`, `excerpt`, `followScroll`) have unit tests. Accuracy,
speed and memory are device checks.
