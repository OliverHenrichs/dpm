import {
  applyReplacements,
  clearReplacements,
  recordReplacement,
  replaceVideoInPattern,
} from "@/src/anonymize/jobs/replaceVideo";
import {
  trimTranscript,
  withoutTranscripts,
} from "@/src/pattern/data/transcripts";
import { IVideoTranscript } from "@/src/pattern/types/IPatternList";
import { createTestPattern } from "@/utils/testFactories";

const TRANSCRIPT: IVideoTranscript = {
  language: "en",
  model: "whisper-base-q5_1",
  createdAt: 1,
  segments: [{ start: 0, end: 2, text: "Anchor." }],
};

const withVideo = (value: string, extra = {}) =>
  createTestPattern("t", {
    id: 1,
    videoRefs: [{ type: "local", value, ...extra }],
  });

afterEach(clearReplacements);

describe("video updates", () => {
  it("replaces a video with a new reference", () => {
    const updated = replaceVideoInPattern(withVideo("a.mp4"), "a.mp4", {
      type: "local",
      value: "b.mp4",
    });
    expect(updated.videoRefs).toEqual([{ type: "local", value: "b.mp4" }]);
  });

  it("derives the new reference from the current one, keeping what it carries", () => {
    const pattern = withVideo("a.mp4", {
      generated: { method: "tracking", createdAt: 5 },
    });

    const updated = replaceVideoInPattern(pattern, "a.mp4", (ref) => ({
      ...ref,
      transcript: TRANSCRIPT,
    }));

    expect(updated.videoRefs[0]).toEqual({
      type: "local",
      value: "a.mp4",
      generated: { method: "tracking", createdAt: 5 },
      transcript: TRANSCRIPT,
    });
  });

  it("applies a recorded update to a draft saved later, on the draft's own reference", () => {
    // An edit form held the video before the transcription finished.
    recordReplacement("a.mp4", (ref) => ({ ...ref, transcript: TRANSCRIPT }));
    const draft = withVideo("a.mp4", { startTime: undefined });

    expect(applyReplacements(draft).videoRefs[0].transcript).toEqual(
      TRANSCRIPT,
    );
  });
});

describe("withoutTranscripts", () => {
  it("removes transcripts from a pattern's videos and its combinations'", () => {
    const pattern = createTestPattern("t", {
      id: 1,
      videoRefs: [{ type: "local", value: "a.mp4", transcript: TRANSCRIPT }],
      modifierRefs: [
        {
          modifierId: "m",
          videoRefs: [
            { type: "url", value: "https://x", transcript: TRANSCRIPT },
          ],
        },
      ],
    });

    const shared = withoutTranscripts(pattern);

    expect(shared.videoRefs[0]).toEqual({ type: "local", value: "a.mp4" });
    expect(shared.modifierRefs[0].videoRefs[0]).toEqual({
      type: "url",
      value: "https://x",
    });
    // The pattern itself is untouched.
    expect(pattern.videoRefs[0].transcript).toBe(TRANSCRIPT);
  });
});

describe("trimTranscript", () => {
  const transcript = {
    language: "en",
    model: "whisper-base-q5_1",
    createdAt: 1,
    segments: [
      { start: 0, end: 2, text: "before" },
      { start: 2, end: 5, text: "into the cut" },
      { start: 5.5, end: 6.5, text: "inside" },
      { start: 6, end: 9, text: "out of the cut" },
      { start: 9, end: 12, text: "after" },
    ],
  };

  it("keeps what was said in the cut, timed from its start", () => {
    expect(trimTranscript(transcript, 3, 7).segments).toEqual([
      { start: 0, end: 2, text: "into the cut" },
      { start: 2.5, end: 3.5, text: "inside" },
      { start: 3, end: 4, text: "out of the cut" },
    ]);
  });

  it("keeps the transcript's other fields, and nothing for a silent cut", () => {
    const trimmed = trimTranscript(transcript, 12, 20);
    expect(trimmed).toEqual({ ...transcript, segments: [] });
  });

  it("changes nothing for a cut over the whole clip", () => {
    expect(trimTranscript(transcript, 0, 12)).toEqual(transcript);
  });
});
