# Sequences: design

Issue: #136. Designed with Oliver on 2026-10-31
([original design doc](https://claude.ai/artifact/1VuucTXjpKdtnR3Rgiffcg)). Each phase's PR folds
what it built into `docs/product/lists-and-figures.md`; the last one deletes this file.

## Why and scope

A sequence is a named, ordered run of a list's figures that someone wants to keep and practise as a whole. Tester review 2 asked for it with three uses: Standard/Latin routines, a WCS Rallye routine, and a combination learned in a workshop.

**In scope for the first version:** naming a sequence, adding, reordering and removing steps, a variant per step, free-text steps, total counts, one video per sequence with a start time per step, export, and publishing with the list.

**Out of scope for now:** suggestions on sequences from subscribers, sequences spanning several lists, music sync by beat detection, and sequences in Reels.

## Where it lives

Sequences get a third segment on the List tab: **Figures · Modifiers · Sequences**, with a count like the other two (Oliver, 2026-10-31). The segment strip is the existing `SegmentedControl` in `PatternListManager.tsx`.

- **Overview:** one row per sequence with its name, step count, total counts, and a video badge when it has one. A + button adds a sequence, as on Figures. An empty state says what a sequence is in one line: "Figures in the order you dance them: a routine, a Rallye, a workshop combination."
- **Opening a sequence** shows its steps as a numbered list (step number, figure name with type colour, variant, counts), the video above the list when there is one, and the sequence's description.
- **Editing** happens in the same screen behind an Edit button, as with figures: name, description, steps, video.
- **Read-only lists** (subscribed, read-only import) show sequences but no Edit or +.

## Data model

Sequences live on the list, next to `modifiers`, so they travel with export and publishing without a new storage key.

```ts
interface IPatternList {
  // …existing fields
  sequences?: ISequence[]; // absent rather than empty
}

interface ISequence {
  id: string;              // UUID
  name: string;
  description?: string;
  video?: IVideoReference; // one video for the whole sequence; reuses today's type
  steps: ISequenceStep[];  // in dancing order
  createdAt: number;
}

type ISequenceStep =
  | { kind: "figure"; id: string; patternId: number; modifierId?: string; note?: string; at?: number }
  | { kind: "free"; id: string; text: string; counts?: number; at?: number };
```

- `id` per step keeps reordering and video marks stable when the same figure appears twice.
- `modifierId` must be a universal modifier or one attached to that figure; the step then shows that variant (and, once variant rhythms land, its counts and rhythm).
- `at` is seconds into the sequence video, set by marking (next sections). Steps without `at` simply don't seek.
- Counts of a step come from the figure (or variant), so changing a figure's counts updates every sequence's total. A free step carries its own optional counts.
- **Export:** minor version bump, validated in `validateExportData.ts`; a step whose figure is missing on import is dropped with a message, as for prerequisites. The sequence video follows the same rules as figure videos (local files only in full exports, transcripts only on opt-in).
- **Publishing:** sequences go into the published list. The rules check named fields of the published list but don't limit its keys (`isSharedList` in `firestore.rules`), so a list with sequences should publish without a rules change; a rules test confirms it. Enforcing the size cap on the server would be a rules change and a rules deploy. Size cap proposal: 50 sequences per list, 200 steps per sequence, which keeps a published list far under Firestore's 1 MiB document limit.

## Building a sequence

Steps are added one tap at a time from a figure picker and reordered by drag and drop.

1. **Add step** opens a picker over the list's figures: fuzzy search as in the prerequisites picker, figures grouped by type with their colour, plus a "Free step" entry at the top.
2. Picking a figure adds it at the end. If the figure has variants (attached or universal modifiers), a pill strip under the new step offers them, the same `ModifierPillStrip` as in the details; no pill means the plain figure.
3. A **free step** is a line of text with optional counts, for what isn't a figure in the list: "4 counts improvised", "pose", "wait for the vocal".
4. Each step's row has a drag handle, a note field (folded away until used), and remove. Long-press duplicates a step, since routines repeat figures.
5. The header shows the running total: steps and counts, and bars for 8-count dances (counts ÷ 8, shown only when it divides evenly per step, otherwise just counts).

**Next-step hints.** The Map's links are prerequisites (learn A before B), not "B can follow A", so they can't suggest a next step honestly. Instead the picker puts first the figures that followed the last step in the list's other sequences. That costs nothing extra and gets useful once a list has a few sequences.

**Figure deleted later.** Deleting a figure that sequences use asks first, naming the sequences ("Used in Rallye 2026 and Workshop combo"); confirming turns those steps into free steps with the figure's name, so the sequence keeps its shape.

## Video mapping

The user marks each step's start while the video plays; afterwards the steps and the video follow each other.

**Marking.** In edit mode with a video set, a **Mark steps** button starts the video from the beginning and shows a big "Mark" button with the next unmarked step's name. Each tap stores the current playback time as that step's `at` and moves to the next step. Back undoes the last mark. Any step can also be re-marked alone: pause where it starts, tap the clock icon on its row. Times show as m:ss on each row and can be nudged ±0.5 s.

**Playback.** Tapping a step seeks the video to its `at`. While playing, the step whose `at` is the latest one passed is highlighted and the list scrolls to keep it in view. A "Loop step" toggle repeats from one mark to the next, for drilling one figure.

**Which videos can do this.** Seeking and reading the playback time are needed:

| Source | How DPM plays it today | Marking and following |
| --- | --- | --- |
| Local file, direct/stream link, Dropbox | `expo-video` player (`FocusPreviewVideo.tsx`, `ReelVideoView.tsx` set `currentTime`) | Yes: the player exposes and sets `currentTime` |
| YouTube | `react-native-youtube-iframe` (`YouTubeVideoItem.tsx`) | Yes: the library's ref has `getCurrentTime()` and `seekTo()` |
| Vimeo | WebView embed (`VimeoVideoItem.tsx`) | Not in phase 1; needs Vimeo's player.js API bridged through the WebView |

For Vimeo the sequence still plays, the steps just don't seek; the UI says so where the Mark button would be.

## Map, sharing and read-only

- **Map:** a "Show sequence" choice in the Map's filter highlights the sequence's figures and draws its order as numbered arrows over the graph, dimming the rest. The prerequisite edges stay as they are; the sequence arrows are a separate, dashed layer. This comes in phase 3, after the List side works.
- **Figure details:** a figure used in sequences lists them under its details ("In: Rallye 2026, Workshop combo"), each a link to the sequence.
- **Sharing:** a published list carries its sequences; subscribers see them read-only and can play and follow the video. Suggesting sequences is out of scope for now.
- **Read-only export:** sequences come along, read-only like the rest of the list.
- **Handover:** nothing special; sequences are part of the list.

## Phases and open questions

Three PRs, each usable on its own; phase 1 is the bulk.

| Phase | What ships | Effort |
| --- | --- | --- |
| 1. Sequences on the List tab | Segment, overview, create/edit, figure and free steps, variants, drag reorder, totals, delete-figure handling, export/import, publishing, i18n in nine languages, tests | L (about the size of members-only lists) |
| 2. Video mapping | One video per sequence, Mark steps, seek on tap, follow while playing, loop step; local, direct links, YouTube | M |
| 3. Map and details | "Show sequence" on the Map, "In: …" under figure details, next-step ordering in the picker | M |

#118 has merged. Own levels (#126) also bumps the export format, so rebase on it first. The variant-rhythm work (attached modifiers only) can land in either order; a step just shows whatever counts its variant has.

**Decided by Oliver (2026-10-31):**

- [x] Name on screen: "Sequences"; the German translation uses "Folgen".
- [x] Free steps: yes, as proposed.
- [x] One video per sequence.
- [x] Bars next to counts for 8-count dances.
- [x] Map highlight stays in phase 3.
