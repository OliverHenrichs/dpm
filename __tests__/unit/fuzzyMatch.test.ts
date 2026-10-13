import { fuzzyFilter, fuzzyScore } from "@/src/common/utils/fuzzyMatch";

describe("fuzzyScore", () => {
  it("matches everything on an empty query", () => {
    expect(fuzzyScore("Whip", "  ")).toBe(0);
  });

  it("ranks the whole text, a prefix, a word start, a substring, then letters in order", () => {
    const scores = [
      fuzzyScore("whip", "whip"),
      fuzzyScore("whiplash", "whip"),
      fuzzyScore("basket whip", "whip"),
      fuzzyScore("bwhip", "whip"),
      fuzzyScore("w-h-i-p", "whip"),
    ];
    expect(scores).toEqual([...scores].sort((a, b) => a! - b!));
    expect(new Set(scores).size).toBe(scores.length);
  });

  it("finds letters in order across words, ignoring spaces in the query", () => {
    expect(fuzzyScore("Sugar Push", "sg psh")).not.toBeNull();
  });

  it("prefers fewer gaps", () => {
    expect(fuzzyScore("sugar push", "sugpu")!).toBeLessThan(
      fuzzyScore("sugar push", "sgpsh")!,
    );
  });

  it("ignores case and accents", () => {
    expect(fuzzyScore("Écart", "ECART")).toBe(0);
  });

  it("rejects letters out of order or missing", () => {
    expect(fuzzyScore("whip", "pihw")).toBeNull();
    expect(fuzzyScore("whip", "whipz")).toBeNull();
  });
});

describe("fuzzyFilter", () => {
  it("puts the best match first and keeps the given order among equals", () => {
    const items = ["tuck turn", "underarm turn", "turn", "free spin"];
    expect(fuzzyFilter(items, "turn", (s) => s)).toEqual([
      "turn",
      "tuck turn",
      "underarm turn",
    ]);
  });
});
