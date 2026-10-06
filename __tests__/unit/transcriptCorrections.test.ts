import {
  correctTranscriptLine,
  setVideoTranscript,
  withTranscript,
} from "@/src/pattern/data/transcripts";
import { IPattern, IVideoTranscript } from "@/src/pattern/types/IPatternList";

const TRANSCRIPT: IVideoTranscript = {
  language: "en",
  model: "whisper-base-q5_1",
  createdAt: 10,
  segments: [
    { start: 0, end: 2, text: "Anchor on five and six." },
    { start: 2, end: 4, text: "Then the sugar bush." },
    { start: 5, end: 7, text: "Thank you." },
  ],
};

describe("correctTranscriptLine", () => {
  it("replaces one line's text, keeping its times, and notes when", () => {
    const corrected = correctTranscriptLine(
      TRANSCRIPT,
      1,
      "  Then the sugar push. ",
      42,
    );

    expect(corrected.segments).toEqual([
      TRANSCRIPT.segments[0],
      { start: 2, end: 4, text: "Then the sugar push." },
      TRANSCRIPT.segments[2],
    ]);
    expect(corrected.editedAt).toBe(42);
    expect(corrected.createdAt).toBe(10);
  });

  it("removes a line corrected to nothing", () => {
    const corrected = correctTranscriptLine(TRANSCRIPT, 2, "   ", 42);

    expect(corrected.segments).toEqual(TRANSCRIPT.segments.slice(0, 2));
  });

  it("changes nothing when the text is the same or the line is gone", () => {
    expect(
      correctTranscriptLine(TRANSCRIPT, 0, "Anchor on five and six. "),
    ).toBe(TRANSCRIPT);
    expect(correctTranscriptLine(TRANSCRIPT, 7, "Whip")).toBe(TRANSCRIPT);
  });
});

describe("withTranscript", () => {
  const ref = { type: "local" as const, value: "/v.mp4" };

  it("puts a transcript on a video without one, or with an older one", () => {
    expect(withTranscript(TRANSCRIPT)(ref)).toEqual({
      ...ref,
      transcript: TRANSCRIPT,
    });
    const older = { ...TRANSCRIPT, createdAt: 1 };
    expect(
      withTranscript(TRANSCRIPT)({ ...ref, transcript: older }).transcript,
    ).toBe(TRANSCRIPT);
  });

  it("keeps the user's corrections when the same transcription is applied again", () => {
    const corrected = correctTranscriptLine(TRANSCRIPT, 1, "Sugar push.");
    const current = { ...ref, transcript: corrected };

    expect(withTranscript(TRANSCRIPT)(current)).toBe(current);
  });
});

describe("setVideoTranscript", () => {
  it("sets the transcript wherever the pattern holds the video", () => {
    const pattern: Pick<IPattern, "videoRefs" | "modifierRefs"> = {
      videoRefs: [
        { type: "local" as const, value: "/a.mp4" },
        { type: "local" as const, value: "/b.mp4" },
      ],
      modifierRefs: [
        {
          modifierId: "m",
          videoRefs: [{ type: "local" as const, value: "/a.mp4" }],
        },
      ],
    };

    const result = setVideoTranscript(pattern, "/a.mp4", TRANSCRIPT);

    expect(result.videoRefs[0].transcript).toBe(TRANSCRIPT);
    expect(result.videoRefs[1].transcript).toBeUndefined();
    expect(result.modifierRefs[0].videoRefs[0].transcript).toBe(TRANSCRIPT);
  });
});
