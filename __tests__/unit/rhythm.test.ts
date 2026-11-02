import {
  appendChainLink,
  appendRhythmStep,
  defaultRhythm,
  lastRhythmStep,
  nextChainLink,
  nextRhythmSteps,
  removeLastRhythmStep,
  normalizeRhythm,
  rhythmCounts,
  rhythmMatchesCounts,
  isSlowQuickRhythm,
  rhythmProblem,
  slowQuickSteps,
  variantTiming,
  withTimingCounts,
  withTimingRhythm,
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
    // Rolling counts (review 2): any number of beats chained, each counted once.
    ["1 2 3&4&5 6", 6],
    ["1 2 3 4 5a6a7 8", 8],
    ["1&2&3&4", 4],
    ["1 2 3&4a5 6", 6],
    ["1 2 (3) 4&5&6", 6],
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
    ["a chain out of step", "1 2 3&5&6"],
    ["a chain running backwards", "1 2 3&4&3"],
    ["a chain with a dangling link", "1 2 3&4&"],
    ["a chain starting with a link", "1 &2"],
    ["a doubled link", "1 2&&3"],
    ["a held chain", "1 (2&3)"],
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

  it("rolls a triple on by one beat, in its own spelling", () => {
    expect(nextChainLink("1 2 3&4")).toBe("&5");
    expect(nextChainLink("1 2 3a4")).toBe("a5");
    expect(nextChainLink("1 2 3&4&5")).toBe("&6");
    expect(appendChainLink("1 2 3&4 ", "&5")).toBe("1 2 3&4&5");
    expect(rhythmCounts(appendChainLink("1 2 3&4", "&5"))).toBe(5);
  });

  it("does not roll on a single step, a held beat or what is not a rhythm", () => {
    expect(nextChainLink("1 2")).toBeUndefined();
    expect(nextChainLink("1 (2)")).toBeUndefined();
    expect(nextChainLink("")).toBeUndefined();
    expect(nextChainLink("1 3&4")).toBeUndefined();
  });

  it("undoes a rolled-on beat before the triple it rolled on from", () => {
    expect(lastRhythmStep("1 2 3&4&5")).toBe("&5");
    expect(removeLastRhythmStep("1 2 3&4&5")).toBe("1 2 3&4");
    expect(removeLastRhythmStep("1 2 3a4a5a6")).toBe("1 2 3a4a5");
    expect(lastRhythmStep("1 2 3&4")).toBe("3&4");
    expect(removeLastRhythmStep("1 2 3&4")).toBe("1 2");
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

describe("slows and quicks (#135)", () => {
  it.each([
    ["S Q Q", 4],
    ["S S Q Q S", 8],
    ["Q Q S", 4],
    ["s q q", 4],
    ["  S   q ", 3],
  ])("reads %s as %i counts, in quicks", (rhythm, counts) => {
    expect(rhythmCounts(rhythm)).toBe(counts);
    expect(rhythmMatchesCounts(rhythm, counts)).toBe(true);
  });

  it.each([
    ["mixed with beats", "S Q 3", "mixed"],
    ["mixed in a token", "1 2 3S", "mixed"],
    ["joined with &", "S Q&Q", "slowQuickJoin"],
    ["joined with a", "QaQ", "slowQuickJoin"],
    ["run together", "SQQ", "invalid"],
    ["another letter", "S Q X", "invalid"],
  ])("refuses a rhythm %s, saying why", (_, rhythm, problem) => {
    expect(rhythmCounts(rhythm)).toBeNull();
    expect(rhythmProblem(rhythm)).toBe(problem);
  });

  it("finds no problem in a rhythm, or in nothing", () => {
    expect(rhythmProblem("S Q Q")).toBeNull();
    expect(rhythmProblem("1 2 3&4")).toBeNull();
    expect(rhythmProblem("  ")).toBeNull();
    expect(rhythmProblem("1 2 4")).toBe("invalid");
  });

  it("writes them in capitals, and leaves a swung triple's a alone", () => {
    expect(normalizeRhythm(" s  q Q ")).toBe("S Q Q");
    expect(normalizeRhythm("1 2 3a4")).toBe("1 2 3a4");
    expect(isSlowQuickRhythm("s q q")).toBe(true);
    expect(isSlowQuickRhythm("1 2")).toBe(false);
    expect(isSlowQuickRhythm("")).toBe(false);
  });

  it("offers S and Q to start with and after slows and quicks, never after beats", () => {
    expect(slowQuickSteps("")).toEqual(["S", "Q"]);
    expect(slowQuickSteps("S Q")).toEqual(["S", "Q"]);
    expect(slowQuickSteps("1 2")).toEqual([]);
    expect(slowQuickSteps("S 2")).toEqual([]);
    // Beat numbers do not follow slows and quicks, nor does a rolled-on link.
    expect(nextRhythmSteps("S Q")).toEqual([]);
    expect(nextChainLink("S Q")).toBeUndefined();
  });

  it("undoes the last slow or quick", () => {
    expect(lastRhythmStep("S Q Q")).toBe("Q");
    expect(removeLastRhythmStep("S Q Q")).toBe("S Q");
  });
});

describe("timing: counts and a rhythm kept matched", () => {
  it("sets the counts from a rhythm, and keeps the counts for text that is not one", () => {
    expect(withTimingRhythm({ counts: 8 }, "s q q")).toEqual({
      counts: 4,
      rhythm: "S Q Q",
    });
    expect(withTimingRhythm({ counts: 8, rhythm: "1 2" }, "1 3")).toEqual({
      counts: 8,
    });
  });

  it("drops a rhythm new counts no longer fit, and with no counts", () => {
    const telemark = { modifierId: "m", counts: 6, rhythm: "1 2 3&4&5 6" };
    expect(withTimingCounts(telemark, 6)).toEqual(telemark);
    expect(withTimingCounts(telemark, 8)).toEqual({
      modifierId: "m",
      counts: 8,
    });
    expect(withTimingCounts(telemark, undefined)).toEqual({ modifierId: "m" });
  });

  it("shows a variant's own timing when it has counts, else the figure's", () => {
    const whip = { counts: 8, rhythm: "1 2 3&4 5 6 7&8" };
    expect(variantTiming(whip, undefined)).toEqual(whip);
    expect(variantTiming(whip, {})).toEqual(whip);
    expect(variantTiming(whip, { counts: 6 })).toEqual({ counts: 6 });
    expect(variantTiming(whip, { counts: 4, rhythm: "S Q Q" })).toEqual({
      counts: 4,
      rhythm: "S Q Q",
    });
  });
});
