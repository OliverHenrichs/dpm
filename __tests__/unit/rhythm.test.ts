import {
  appendRhythmElement,
  appendRhythmStep,
  defaultRhythm,
  lastRhythmStep,
  nextRhythmElements,
  removeLastRhythmStep,
  rhythmElements,
  rhythmElementText,
  normalizeRhythm,
  rhythmCounts,
  rhythmMatchesCounts,
  isSlowQuickRhythm,
  rhythmProblem,
  slowQuickSteps,
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
    ["a dangling link before another step", "1 2 3&4& 5"],
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

describe("subdivisions and holds (2026-11-02)", () => {
  it.each([
    ["1 2 3&a4", 4],
    ["1 2 3a4", 4],
    ["1 2 3&4", 4],
    ["1 2 3&4&5", 5],
    ["1 2 3 4 5a6a7", 7],
    ["1&a2&a3", 3],
    ["1 2 3&a4&a5 6", 6],
    // Only the last token may end on a subdivision, and counts go by whole beats.
    ["1 2 3&", 3],
    ["1 2 3&a", 3],
    ["1 2 3a", 3],
    ["1&", 1],
    // Any single element held.
    ["1 2 3(&)4", 4],
    ["1 2 3&(a)4", 4],
    ["1 2 3&(4)", 4],
    ["1 2 (3)&4", 4],
    ["1 2 (3)(&)(a)(4)", 4],
    ["1 2 3(a)", 3],
    ["1 2 3&4 (5)", 5],
    // A pickup before beat 1 belongs to the bar before and adds no count.
    ["&a1 2 3&4 5&6", 6],
    ["a1 2", 2],
    ["&1", 1],
    ["(&)a1", 1],
  ])("reads %s as %i counts", (rhythm, counts) => {
    expect(rhythmCounts(rhythm)).toBe(counts);
    expect(rhythmMatchesCounts(rhythm, counts)).toBe(true);
  });

  it.each([
    ["a out of order", "1 2 3a&4"],
    ["a doubled &", "1 2 3&&4"],
    ["a doubled a", "1 2 3aa4"],
    ["a doubled held &", "1 2 3&(&)4"],
    ["a subdivision with no beat", "1 2 &"],
    ["a token starting on a subdivision", "1 2 3 &4"],
    ["a subdivision spaced off its beat", "1 2 3& 4"],
    ["a held subdivision spaced off its beat", "1 2 3(&) 4"],
    ["a beat run onto a beat", "1 2 3(4)"],
    ["a held beat run onto a beat", "1 2 (3)4"],
    ["a held pair", "1 2 (3&)4"],
    ["an empty hold", "1 2 ()"],
    ["a doubled hold", "1 2 ((3))"],
    ["an e", "1 2 3e&a4"],
    ["a capital A", "1 2 3A4"],
    ["a chain with a gap", "1 2 3&a5"],
    ["a pickup out of order", "a&1"],
    ["a pickup spaced off beat 1", "&a 1"],
    ["a pickup with no beat", "&a"],
    ["a pickup after the first token", "1 &a2"],
    ["a pickup onto beat 2", "&a2"],
  ])("refuses %s", (_, rhythm) => {
    expect(rhythmCounts(rhythm)).toBeNull();
  });

  it("explains a subdivision out of order or spaced off its beat", () => {
    expect(rhythmProblem("1 2 3a&4")).toBe("markOrder");
    expect(rhythmProblem("1 2 3&&4")).toBe("markOrder");
    expect(rhythmProblem("1 2 3&(&)4")).toBe("markOrder");
    expect(rhythmProblem("1 2 3& 4")).toBe("markSplit");
    expect(rhythmProblem("1 2 3(&) 4")).toBe("markSplit");
    // Joining would not make it a rhythm, so the general explanation stays.
    expect(rhythmProblem("1 2 3& 5")).toBe("invalid");
    expect(rhythmProblem("1 2 3&")).toBeNull();
  });

  it("reads the elements in order, held or not", () => {
    expect(rhythmElements("1 2&(a)3")).toEqual([
      { value: 1, held: false },
      { value: 2, held: false },
      { value: "&", held: false },
      { value: "a", held: true },
      { value: 3, held: false },
    ]);
    expect(rhythmElements("S Q Q")).toBeNull();
    expect(rhythmElements("")).toBeNull();
  });

  it("writes one spelling", () => {
    expect(normalizeRhythm("  1  2 3&a4  ")).toBe("1 2 3&a4");
    expect(normalizeRhythm("01 2 3")).toBe("1 2 3");
    expect(normalizeRhythm("1 2 3(&)4 (5)")).toBe("1 2 3(&)4 (5)");
    // Text that is not a rhythm only has its spacing tidied.
    expect(normalizeRhythm(" 1  2 3& 4")).toBe("1 2 3& 4");
  });

  it("keeps every rhythm the old notation took, with the same counts and spelling", () => {
    const old: [string, number][] = [
      ["1 2 3&4 5&6", 6],
      ["1 2 3a4 5a6", 6],
      ["1 2 3&4 5 6 7&8", 8],
      ["1 2 3a4 5 6 7a8", 8],
      ["1 2 3 (4) 5 6 7 (8)", 8],
      ["1 2 3 (4) 5 6 7 (8) 9 10 11 (12) 13 14 15 (16)", 16],
      ["1 (2) 3 4 5 (6) 7 8", 8],
      ["1 2 3&4&5 6", 6],
      ["1&2&3&4", 4],
      ["1 2 3&4a5 6", 6],
      ["1 2 (3) 4&5&6", 6],
      ["1 2 3 4 5a6a7 8", 8],
    ];
    for (const [rhythm, counts] of old) {
      expect(rhythmCounts(rhythm)).toBe(counts);
      expect(normalizeRhythm(rhythm)).toBe(rhythm);
    }
  });
});

describe("a pickup (2026-11-02)", () => {
  it("is on its way to a rhythm, not wrong, until beat 1 comes", () => {
    expect(rhythmCounts("&a")).toBeNull();
    expect(rhythmProblem("&")).toBeNull();
    expect(rhythmProblem("&a")).toBeNull();
    expect(rhythmProblem("&a 1")).toBe("markSplit");
  });

  it("is composed and undone like any other element", () => {
    expect(appendRhythmElement("", "&")).toBe("&");
    expect(appendRhythmElement("&", "a")).toBe("&a");
    expect(appendRhythmElement("&a", 1)).toBe("&a1");
    expect(removeLastRhythmStep("&a1")).toBe("&a");
    expect(lastRhythmStep("&")).toBe("&");
    expect(normalizeRhythm("&a1  2")).toBe("&a1 2");
  });
});

describe("composing a rhythm an element at a time", () => {
  it("offers the next beat, then & after a beat and a after a beat or its &", () => {
    expect(nextRhythmElements("")).toEqual([1, "&", "a"]);
    expect(nextRhythmElements("&")).toEqual([1, "a"]);
    expect(nextRhythmElements("&a")).toEqual([1]);
    expect(nextRhythmElements("a")).toEqual([1]);
    expect(nextRhythmElements("1 2")).toEqual([3, "&", "a"]);
    expect(nextRhythmElements("1 2&")).toEqual([3, "a"]);
    expect(nextRhythmElements("1 2&a")).toEqual([3]);
    expect(nextRhythmElements("1 2a")).toEqual([3]);
    expect(nextRhythmElements("1 (2)")).toEqual([3, "&", "a"]);
    expect(nextRhythmElements("1 2(&)")).toEqual([3, "a"]);
  });

  it("offers nothing after slows and quicks or what is not a rhythm", () => {
    expect(nextRhythmElements("1 3")).toEqual([]);
    expect(nextRhythmElements("S Q")).toEqual([]);
    expect(nextRhythmElements("1 2 walk")).toEqual([]);
  });

  it("appends in the one spelling: a beat chains after a subdivision, else starts a token", () => {
    expect(appendRhythmElement("", 1)).toBe("1");
    expect(appendRhythmElement("1 2 3", 4)).toBe("1 2 3 4");
    expect(appendRhythmElement("1 2 3", "&")).toBe("1 2 3&");
    expect(appendRhythmElement("1 2 3&", "a")).toBe("1 2 3&a");
    expect(appendRhythmElement("1 2 3&a", 4)).toBe("1 2 3&a4");
    expect(appendRhythmElement(" 1  2 ", 3)).toBe("1 2 3");
  });

  it("appends an element held", () => {
    expect(appendRhythmElement("", 1, true)).toBe("(1)");
    expect(appendRhythmElement("1 2 3", 4, true)).toBe("1 2 3 (4)");
    expect(appendRhythmElement("1 2 3", "&", true)).toBe("1 2 3(&)");
    expect(appendRhythmElement("1 2 3&", "a", true)).toBe("1 2 3&(a)");
    expect(appendRhythmElement("1 2 3&", 4, true)).toBe("1 2 3&(4)");
    expect(appendRhythmElement("1 2 3(&)", 4)).toBe("1 2 3(&)4");
  });

  it("leaves what is not a rhythm in counts as it is", () => {
    expect(appendRhythmElement("1 3", 4)).toBe("1 3");
    expect(appendRhythmElement("S Q", 4)).toBe("S Q");
  });

  it("writes an element, held or not", () => {
    expect(rhythmElementText(5)).toBe("5");
    expect(rhythmElementText("&", true)).toBe("(&)");
  });

  it("undoes exactly the last element", () => {
    let written = "1 2 3&a4";
    const seen = [written];
    while (written) {
      written = removeLastRhythmStep(written);
      seen.push(written);
    }
    expect(seen).toEqual([
      "1 2 3&a4",
      "1 2 3&a",
      "1 2 3&",
      "1 2 3",
      "1 2",
      "1",
      "",
    ]);
    expect(lastRhythmStep("1 2 3&a4")).toBe("4");
    expect(lastRhythmStep("1 2 3&a")).toBe("a");
  });

  it("undoes a held element, and the chain it closed", () => {
    expect(lastRhythmStep("1 2 3&(4)")).toBe("(4)");
    expect(removeLastRhythmStep("1 2 3&(4)")).toBe("1 2 3&");
    expect(lastRhythmStep("1 2 3(&)")).toBe("(&)");
    expect(removeLastRhythmStep("1 2 3(&)4")).toBe("1 2 3(&)");
    expect(removeLastRhythmStep("1 2 3&4&5")).toBe("1 2 3&4&");
    expect(removeLastRhythmStep("1 (2)")).toBe("1");
  });

  it("undoes a word at a time in text that is not a rhythm yet", () => {
    expect(lastRhythmStep("1 2 4")).toBe("4");
    expect(removeLastRhythmStep(" 1 2 4 ")).toBe("1 2");
    expect(removeLastRhythmStep("1")).toBe("");
    expect(removeLastRhythmStep("")).toBe("");
    expect(lastRhythmStep("  ")).toBeUndefined();
  });

  it("only ever composes rhythms", () => {
    let written = "";
    for (let i = 0; i < 12; i++) {
      const next = nextRhythmElements(written);
      written = appendRhythmElement(
        written,
        next[i % next.length],
        i % 3 === 0,
      );
      expect(rhythmCounts(written)).not.toBeNull();
      expect(normalizeRhythm(written)).toBe(written);
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
    expect(nextRhythmElements("S Q")).toEqual([]);
  });

  it("undoes the last slow or quick", () => {
    expect(lastRhythmStep("S Q Q")).toBe("Q");
    expect(removeLastRhythmStep("S Q Q")).toBe("S Q");
    expect(appendRhythmStep("S Q ", "Q")).toBe("S Q Q");
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
});
