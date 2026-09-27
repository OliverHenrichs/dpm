/** A stretch of the audio to transcribe, in seconds. */
export type SpeechRegion = { start: number; end: number };

/** Stretches closer than this are transcribed together: a pause mid-explanation is not an end. */
const JOIN_GAP_S = 1.5;
/** Kept around each stretch, so a word cut by the detector's edge is still whole. */
const PAD_S = 0.25;
/** Detected speech shorter than this — before padding — is a cough or a count, not a sentence. */
const MIN_REGION_S = 0.4;

/**
 * Turns the voice-activity detector's segments into the regions Whisper transcribes: padded,
 * joined across short pauses, and clamped to the clip.
 *
 * whisper.cpp reports VAD times in **centiseconds** (`samples_to_cs` in whisper.cpp), although
 * whisper.rn's README prints them as if they were seconds.
 */
export function speechRegions(
  vadCentiseconds: { t0: number; t1: number }[],
  durationS: number,
): SpeechRegion[] {
  const regions: SpeechRegion[] = [];
  const sorted = [...vadCentiseconds].sort((a, b) => a.t0 - b.t0);
  for (const { t0, t1 } of sorted) {
    if ((t1 - t0) / 100 < MIN_REGION_S) continue;
    const start = Math.max(0, t0 / 100 - PAD_S);
    const end = Math.min(durationS, t1 / 100 + PAD_S);
    if (end <= start) continue;
    const last = regions.at(-1);
    if (last && start - last.end <= JOIN_GAP_S) {
      last.end = Math.max(last.end, end);
    } else {
      regions.push({ start, end });
    }
  }
  return regions;
}
