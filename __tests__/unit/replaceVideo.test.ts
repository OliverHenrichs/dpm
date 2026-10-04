import {
  applyReplacements,
  clearReplacements,
  recordReplacement,
  replaceVideoInPattern,
} from "@/src/anonymize/jobs/replaceVideo";
import { IVideoReference } from "@/src/pattern/types/IPatternList";
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

  it("never grows a full group past three videos", () => {
    const full = [
      { type: "local" as const, value: OLD },
      other,
      { type: "url" as const, value: "https://y.tube/z" },
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
