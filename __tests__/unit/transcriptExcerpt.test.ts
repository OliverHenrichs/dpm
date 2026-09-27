import {
  appendToDescription,
  segmentAt,
  transcriptExcerpt,
} from "@/src/transcribe/excerpt";

const SEGMENTS = [
  { start: 0, end: 2, text: "Anchor on five and six." },
  { start: 2, end: 4, text: " Keep the frame. " },
  { start: 5, end: 7, text: "Then the whip." },
];

describe("transcriptExcerpt", () => {
  it("joins the ticked lines in the order they were said", () => {
    expect(transcriptExcerpt(SEGMENTS, new Set([2, 0]))).toBe(
      "Anchor on five and six. Then the whip.",
    );
  });

  it("is empty when nothing is ticked", () => {
    expect(transcriptExcerpt(SEGMENTS, new Set())).toBe("");
  });

  it("trims each line", () => {
    expect(transcriptExcerpt(SEGMENTS, new Set([1]))).toBe("Keep the frame.");
  });
});

describe("appendToDescription", () => {
  it("adds a paragraph of its own after the user's text", () => {
    expect(appendToDescription("Mine.\n", "Theirs.")).toBe("Mine.\n\nTheirs.");
  });

  it("fills an empty description", () => {
    expect(appendToDescription("", "Theirs.")).toBe("Theirs.");
  });

  it("leaves the description alone for an empty excerpt", () => {
    expect(appendToDescription("Mine.", "  ")).toBe("Mine.");
  });
});

describe("segmentAt", () => {
  it("finds the line being said, and none in a pause", () => {
    expect(segmentAt(SEGMENTS, 3)).toBe(1);
    expect(segmentAt(SEGMENTS, 4.5)).toBe(-1);
  });
});
