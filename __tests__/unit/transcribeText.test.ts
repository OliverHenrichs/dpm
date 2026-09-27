import { speechRegions } from "@/src/transcribe/speechRegions";
import {
  splitLongSegments,
  toTranscriptSegments,
} from "@/src/transcribe/segments";

describe("speechRegions", () => {
  it("reads the detector's centiseconds as seconds, padded", () => {
    // 2.00–5.00 s of speech, as whisper.cpp reports it.
    expect(speechRegions([{ t0: 200, t1: 500 }], 60)).toEqual([
      { start: 1.75, end: 5.25 },
    ]);
  });

  it("joins stretches across a short pause, and keeps a long pause apart", () => {
    const regions = speechRegions(
      [
        { t0: 100, t1: 300 },
        { t0: 400, t1: 600 }, // 1 s later: the same explanation
        { t0: 1500, t1: 1800 }, // 9 s later: a new one
      ],
      60,
    );

    expect(regions).toEqual([
      { start: 0.75, end: 6.25 },
      { start: 14.75, end: 18.25 },
    ]);
  });

  it("drops blips too short to be a sentence", () => {
    expect(speechRegions([{ t0: 1000, t1: 1005 }], 60)).toEqual([]);
  });

  it("stays within the clip", () => {
    expect(speechRegions([{ t0: 0, t1: 1000 }], 9.9)).toEqual([
      { start: 0, end: 9.9 },
    ]);
  });

  it("finds nothing in silence or music", () => {
    expect(speechRegions([], 60)).toEqual([]);
  });
});

describe("toTranscriptSegments", () => {
  it("converts centiseconds, trims and collapses whitespace", () => {
    expect(
      toTranscriptSegments([{ t0: 150, t1: 420, text: "  Step   back,  " }]),
    ).toEqual([{ start: 1.5, end: 4.2, text: "Step back," }]);
  });

  it("drops what is not speech", () => {
    const kept = toTranscriptSegments([
      { t0: 0, t1: 100, text: "[MUSIC]" },
      { t0: 100, t1: 200, text: " *Music* " },
      { t0: 200, t1: 300, text: "(applause)" },
      { t0: 300, t1: 400, text: "♪" },
      { t0: 400, t1: 500, text: "   " },
      { t0: 500, t1: 600, text: "Anchor on five and six." },
    ]);

    expect(kept.map((s) => s.text)).toEqual(["Anchor on five and six."]);
  });
});

describe("splitLongSegments", () => {
  it("leaves a short line alone", () => {
    const line = { start: 0, end: 3, text: "Walk walk, triple step." };
    expect(splitLongSegments([line])).toEqual([line]);
  });

  it("splits a long line at sentence ends, sharing its time out by length", () => {
    const text =
      "So this is a short video on West Coast swing. We test the speech recognition. It should work.";
    const pieces = splitLongSegments([{ start: 10, end: 20, text }], 50);

    expect(pieces.map((p) => p.text)).toEqual([
      "So this is a short video on West Coast swing.",
      "We test the speech recognition. It should work.",
    ]);
    expect(pieces[0].start).toBe(10);
    expect(pieces.at(-1)!.end).toBe(20);
    // Contiguous, and in proportion to what is said.
    expect(pieces[1].start).toBeCloseTo(pieces[0].end);
    expect(pieces[0].end).toBeGreaterThan(14);
    expect(pieces[0].end).toBeLessThan(16);
  });

  it("falls back to commas in a long sentence", () => {
    const text =
      "Lead the follower forward, turn her under your arm, then catch her on six";
    const pieces = splitLongSegments([{ start: 0, end: 9, text }], 40);

    expect(pieces.length).toBeGreaterThan(1);
    expect(pieces.every((p) => p.text.length <= 40)).toBe(true);
    expect(pieces.map((p) => p.text).join(" ")).toBe(text);
  });
});
