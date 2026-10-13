import {
  appendRhythmStep,
  defaultRhythm,
  lastRhythmStep,
  nextRhythmSteps,
  removeLastRhythmStep,
  normalizeRhythm,
  rhythmCounts,
  rhythmMatchesCounts,
} from "@/src/pattern/rhythm/rhythm";
import { DANCES } from "@/src/pattern/types/Dance";
import {
  createPatternType,
  resolveTemplatePatterns,
} from "@/src/pattern/data/DefaultPatternLists";

describe("rhythmCounts", () => {
  it.each([
    ["1 2 3&4 5&6", 6],
    ["1 2 3a4 5a6", 6],
    ["1 2 3&4 5 6 7&8", 8],
    ["1 2 3 (4) 5 6 7 (8)", 8],
    ["  1   2 ", 2],
  ])("reads %s as %i counts", (rhythm, counts) => {
    expect(rhythmCounts(rhythm)).toBe(counts);
  });

  it.each([
    ["empty", ""],
    ["a gap", "1 2 4"],
    ["out of order", "2 1"],
    ["not starting at 1", "2 3"],
    ["a word", "1 2 walk"],
    ["a triple out of step", "1 2 4&5"],
    ["an unclosed hold", "1 (2"],
  ])("refuses %s", (_, rhythm) => {
    expect(rhythmCounts(rhythm)).toBeNull();
  });

  it("matches a rhythm against counts", () => {
    expect(rhythmMatchesCounts("1 2 3&4 5&6", 6)).toBe(true);
    expect(rhythmMatchesCounts("1 2 3&4 5&6", 8)).toBe(false);
  });

  it("tidies the spacing", () => {
    expect(normalizeRhythm("  1  2 3&4 ")).toBe("1 2 3&4");
  });
});

describe("defaultRhythm", () => {
  it("gives a dance's basic rhythm for the counts", () => {
    expect(defaultRhythm("wcs", 8)).toBe("1 2 3&4 5 6 7&8");
    expect(defaultRhythm("salsa", 8)).toBe("1 2 3 (4) 5 6 7 (8)");
    expect(defaultRhythm("zouk", 8)).toBe("1 (2) 3 4 5 (6) 7 8");
  });

  it("gives none without a dance, or for counts a dance has none for", () => {
    expect(defaultRhythm(undefined, 8)).toBeUndefined();
    expect(defaultRhythm("tango", 8)).toBeUndefined();
    expect(defaultRhythm("wcs", 5)).toBeUndefined();
  });

  it("only ever gives rhythms that fit", () => {
    for (const dance of DANCES) {
      for (let counts = 1; counts <= 16; counts++) {
        const rhythm = defaultRhythm(dance, counts);
        if (rhythm) expect(rhythmCounts(rhythm)).toBe(counts);
      }
    }
  });
});

describe("template rhythms", () => {
  it("start a template's patterns on the dance's basic rhythm", () => {
    const types = [createPatternType("push", "#000000")];
    const [push, other] = resolveTemplatePatterns(
      [
        { name: "Sugar Push", typeSlug: "push", counts: 6, description: "" },
        { name: "Long", typeSlug: "push", counts: 12, description: "" },
      ],
      types,
      "wcs",
    );

    expect(push.rhythm).toBe("1 2 3&4 5&6");
    expect(other).not.toHaveProperty("rhythm");
    expect(defaultRhythm(undefined, 6)).toBeUndefined();
  });
});

describe("composing a rhythm a step at a time", () => {
  it("offers a step, a triple, a swung triple and a held beat on the next beat", () => {
    expect(nextRhythmSteps("1 2")).toEqual(["3", "3&4", "3a4", "(3)"]);
    expect(nextRhythmSteps("")).toEqual(["1", "1&2", "1a2", "(1)"]);
  });

  it("goes on after a triple", () => {
    expect(nextRhythmSteps("1 2 3&4")[0]).toBe("5");
  });

  it("offers nothing after something that is not a rhythm", () => {
    expect(nextRhythmSteps("1 3")).toEqual([]);
  });

  it("appends with a single space", () => {
    expect(appendRhythmStep("1 2 ", "3&4")).toBe("1 2 3&4");
    expect(appendRhythmStep("", "1")).toBe("1");
  });

  it("takes the last step off again", () => {
    expect(removeLastRhythmStep("1 2 3&4 ")).toBe("1 2");
    expect(removeLastRhythmStep("1")).toBe("");
    expect(removeLastRhythmStep("")).toBe("");
    expect(lastRhythmStep(" 1 2 3a4 ")).toBe("3a4");
    expect(lastRhythmStep("  ")).toBeUndefined();
  });

  it("only ever composes rhythms", () => {
    let written = "";
    for (let i = 0; i < 6; i++) {
      const steps = nextRhythmSteps(written);
      written = appendRhythmStep(written, steps[i % steps.length]);
      expect(rhythmCounts(written)).not.toBeNull();
    }
  });
});
