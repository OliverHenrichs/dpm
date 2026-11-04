import {
  applyReplacements,
  applySequenceReplacements,
  clearReplacements,
  MAX_VIDEOS,
  recordReplacement,
  replaceVideoInPattern,
  replaceVideoInSequence,
  replaceVideoInSequences,
} from "@/src/anonymize/jobs/replaceVideo";
import { ISequence, IVideoReference } from "@/src/pattern/types/IPatternList";
import { createTestPattern } from "@/utils/testFactories";

const OLD = "file:///document/video-a.mp4";
const NEW: IVideoReference = {
  type: "local",
  value: "file:///document/anonymized-b.mp4",
  generated: { method: "on-device-tracking", createdAt: 1 },
};
const other: IVideoReference = { type: "url", value: "https://y.tube/x" };

afterEach(clearReplacements);

describe("replaceVideoInPattern", () => {
  it("swaps the pattern's own video in place, keeping the others and their order", () => {
    const p = createTestPattern("t", {
      videoRefs: [other, { type: "local", value: OLD }],
    });
    expect(replaceVideoInPattern(p, OLD, NEW).videoRefs).toEqual([other, NEW]);
  });

  it("swaps a modifier combination's video too", () => {
    const p = createTestPattern("t", {
      modifierRefs: [
        { modifierId: "m", videoRefs: [{ type: "local", value: OLD }] },
      ],
    });
    expect(
      replaceVideoInPattern(p, OLD, NEW).modifierRefs[0].videoRefs,
    ).toEqual([NEW]);
  });

  it("keeps both: the new video goes right after the original", () => {
    const p = createTestPattern("t", {
      videoRefs: [{ type: "local", value: OLD }, other],
    });
    expect(
      replaceVideoInPattern(p, OLD, (ref) => [ref, NEW]).videoRefs,
    ).toEqual([{ type: "local", value: OLD }, NEW, other]);
  });

  it("does not add a kept video twice when applied again", () => {
    const p = createTestPattern("t", {
      videoRefs: [{ type: "local", value: OLD }],
    });
    const keepBoth = (ref: IVideoReference) => [ref, NEW];
    const once = replaceVideoInPattern(p, OLD, keepBoth);
    expect(replaceVideoInPattern(once, OLD, keepBoth).videoRefs).toEqual([
      { type: "local", value: OLD },
      NEW,
    ]);
  });

  it("never grows a full group past MAX_VIDEOS", () => {
    const full: IVideoReference[] = [
      { type: "local", value: OLD },
      ...Array.from({ length: MAX_VIDEOS - 1 }, (_, i) => ({
        type: "url" as const,
        value: `https://y.tube/${i}`,
      })),
    ];
    const p = createTestPattern("t", { videoRefs: full });
    expect(
      replaceVideoInPattern(p, OLD, (ref) => [ref, NEW]).videoRefs,
    ).toEqual(full);
  });

  it("returns the same object when the video is not there", () => {
    const p = createTestPattern("t", { videoRefs: [other] });
    expect(replaceVideoInPattern(p, OLD, NEW)).toBe(p);
  });

  it("returns the same object when the update is already applied", () => {
    // A transcript on the same video, or both kept: the update matches every time it runs.
    const transcript = {
      language: "en",
      model: "whisper",
      createdAt: 1,
      segments: [],
    };
    const addTranscript = (ref: IVideoReference) => ({ ...ref, transcript });
    const keepBoth = (ref: IVideoReference) => [ref, NEW];
    const p = createTestPattern("t", {
      videoRefs: [{ type: "local", value: OLD }],
      modifierRefs: [
        { modifierId: "m", videoRefs: [{ type: "local", value: OLD }] },
      ],
    });
    const transcribed = replaceVideoInPattern(p, OLD, addTranscript);
    expect(transcribed).not.toBe(p);
    expect(replaceVideoInPattern(transcribed, OLD, addTranscript)).toBe(
      transcribed,
    );
    const kept = replaceVideoInPattern(p, OLD, keepBoth);
    expect(replaceVideoInPattern(kept, OLD, keepBoth)).toBe(kept);
  });
});

describe("applyReplacements", () => {
  it("puts a finished job's video into a draft that still holds the original", () => {
    recordReplacement(OLD, NEW);
    const draft = createTestPattern("t", {
      videoRefs: [{ type: "local", value: OLD }],
    });
    expect(applyReplacements(draft).videoRefs).toEqual([NEW]);
  });

  it("leaves a pattern alone when no job has finished", () => {
    const draft = createTestPattern("t", {
      videoRefs: [{ type: "local", value: OLD }],
    });
    expect(applyReplacements(draft)).toBe(draft);
  });
});

describe("a sequence's video", () => {
  const marked = (at: (number | undefined)[]): ISequence => ({
    id: "s",
    name: "Rallye",
    createdAt: 1,
    video: { type: "local", value: OLD },
    steps: at.map((a, i) => ({
      kind: "free",
      id: `f${i}`,
      text: "pose",
      ...(a !== undefined && { at: a }),
    })),
  });
  const marks = (s: ISequence) => s.steps.map((step) => step.at);
  const CUT = { start: 3, end: 8 };

  it("replaces the video with its cut, moving the marks inside it and dropping the rest", () => {
    const s = marked([1, 3, 5.5, undefined, 8, 9]);
    const replaced = replaceVideoInSequence(s, OLD, NEW, CUT);
    expect(replaced.video).toEqual(NEW);
    expect(marks(replaced)).toEqual([
      undefined,
      0,
      2.5,
      undefined,
      5,
      undefined,
    ]);
    replaced.steps
      .filter((step) => step.at === undefined)
      .forEach((step) => expect(step).not.toHaveProperty("at"));
  });

  it("keeps both: the sequence keeps its original and its marks", () => {
    const s = marked([1, 5]);
    expect(replaceVideoInSequence(s, OLD, (prev) => [prev, NEW], CUT)).toBe(s);
  });

  it("leaves the marks of a video that stays the same one (a transcript, a link)", () => {
    const s = marked([1, 5]);
    const withLine = replaceVideoInSequence(s, OLD, (prev) => ({
      ...prev,
      transcript: { language: "en", model: "m", createdAt: 1, segments: [] },
    }));
    expect(withLine.video?.transcript).toBeDefined();
    expect(marks(withLine)).toEqual([1, 5]);
    const linked = replaceVideoInSequence(s, OLD, other);
    expect(linked.video).toEqual(other);
    expect(marks(linked)).toEqual([1, 5]);
  });

  it("returns the same objects when the video is not the sequence's", () => {
    const s = marked([1]);
    const list = [s];
    expect(replaceVideoInSequence(s, "file:///other.mp4", NEW, CUT)).toBe(s);
    expect(replaceVideoInSequences(list, "file:///other.mp4", NEW)).toBe(list);
    expect(replaceVideoInSequences(undefined, OLD, NEW)).toBeUndefined();
    expect(replaceVideoInSequences(list, OLD, NEW)?.[0].video).toEqual(NEW);
  });

  it("puts a finished cut into a draft that still holds the original, once", () => {
    recordReplacement(OLD, NEW, CUT);
    const draft = marked([4, 10]);
    const applied = applySequenceReplacements(draft);
    expect(applied.video).toEqual(NEW);
    expect(marks(applied)).toEqual([1, undefined]);
    expect(applySequenceReplacements(applied)).toBe(applied);
    // Patterns take the same replacement, with no marks to move.
    const p = createTestPattern("t", {
      videoRefs: [{ type: "local", value: OLD }],
    });
    expect(applyReplacements(p).videoRefs).toEqual([NEW]);
  });
});
