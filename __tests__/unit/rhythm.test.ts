import {
  appendRhythmStep,
  defaultRhythm,
  nextRhythmSteps,
  normalizeRhythm,
  rhythmCounts,
  rhythmMatchesCounts,
  rhythmSuggestions,
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

describe("rhythmSuggestions", () => {
  it("offers a dance's own rhythm first, then a step on every beat", () => {
    expect(rhythmSuggestions("wcs", 8)).toEqual([
      "1 2 3&4 5 6 7&8",
      "1 2 3a4 5 6 7a8",
      "1 2 3 4 5 6 7 8",
    ]);
    expect(rhythmSuggestions("salsa", 8)[0]).toBe("1 2 3 (4) 5 6 7 (8)");
  });

  it("differs between dances for the same counts", () => {
    expect(rhythmSuggestions("lindy", 8)[0]).not.toBe(
      rhythmSuggestions("bachata", 8)[0],
    );
  });

  it("offers only the plain rhythm without a dance, or for counts a dance has none for", () => {
    expect(rhythmSuggestions(undefined, 4)).toEqual(["1 2 3 4"]);
    expect(rhythmSuggestions("tango", 8)).toEqual(["1 2 3 4 5 6 7 8"]);
  });

  it("offers nothing for counts no one counts out", () => {
    expect(rhythmSuggestions(undefined, 0)).toEqual([]);
    expect(rhythmSuggestions(undefined, 32)).toEqual([]);
  });

  it("only ever suggests rhythms that fit", () => {
    for (const dance of [...DANCES, undefined]) {
      for (let counts = 1; counts <= 16; counts++) {
        for (const rhythm of rhythmSuggestions(dance, counts)) {
          expect(rhythmCounts(rhythm)).toBe(counts);
        }
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

  it("only ever composes rhythms", () => {
    let written = "";
    for (let i = 0; i < 6; i++) {
      const steps = nextRhythmSteps(written);
      written = appendRhythmStep(written, steps[i % steps.length]);
      expect(rhythmCounts(written)).not.toBeNull();
    }
  });
});
