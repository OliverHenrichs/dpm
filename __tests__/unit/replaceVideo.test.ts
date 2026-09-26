import {
  applyReplacements,
  clearReplacements,
  recordReplacement,
  replaceVideoInPattern,
} from "@/src/deidentify/jobs/replaceVideo";
import { IVideoReference } from "@/src/pattern/types/IPatternList";
import { createTestPattern } from "@/utils/testFactories";

const OLD = "file:///document/video-a.mp4";
const NEW: IVideoReference = {
  type: "local",
  value: "file:///document/deidentified-b.mp4",
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

  it("returns the same object when the video is not there", () => {
    const p = createTestPattern("t", { videoRefs: [other] });
    expect(replaceVideoInPattern(p, OLD, NEW)).toBe(p);
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
