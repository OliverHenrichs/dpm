import {
  applyCorrections,
  correctionsFromEdit,
  applyLearnedCorrections,
  MAX_CORRECTIONS,
  mergeCorrections,
} from "@/src/transcribe/corrections";

describe("correctionsFromEdit", () => {
  it("learns the misheard words the user fixed", () => {
    expect(
      correctionsFromEdit(
        "Now we do a sugar bush on five.",
        "Now we do a sugar push on five.",
      ),
    ).toEqual([{ from: "bush", to: "push" }]);
  });

  it("learns a phrase, and each separate fix in a line", () => {
    expect(
      correctionsFromEdit(
        "A left sight pass, then a wipe.",
        "A left side pass, then a whip.",
      ),
    ).toEqual([
      { from: "sight", to: "side" },
      { from: "wipe", to: "whip" },
    ]);
    expect(
      correctionsFromEdit("Do the and core step.", "Do the anchor step."),
    ).toEqual([{ from: "and core", to: "anchor" }]);
  });

  it("learns nothing from case, punctuation, added or removed words", () => {
    expect(correctionsFromEdit("sugar push.", "Sugar Push!")).toEqual([]);
    expect(correctionsFromEdit("um, so, the whip", "the whip")).toEqual([]);
    expect(correctionsFromEdit("the whip", "the basic whip")).toEqual([]);
  });

  it("learns nothing from a rewrite", () => {
    expect(
      correctionsFromEdit(
        "and then you go like this and that",
        "Lead the follower into a tuck turn with compression",
      ),
    ).toEqual([]);
  });
});

describe("mergeCorrections", () => {
  it("puts the newest first, one per misheard phrase", () => {
    const merged = mergeCorrections(
      [
        { from: "bush", to: "pash" },
        { from: "wipe", to: "whip" },
      ],
      [{ from: "bush", to: "push" }],
    );

    expect(merged).toEqual([
      { from: "bush", to: "push" },
      { from: "wipe", to: "whip" },
    ]);
  });

  it("forgets a fix the user undoes instead of learning the reverse", () => {
    expect(
      mergeCorrections(
        [{ from: "bush", to: "push" }],
        [{ from: "push", to: "bush" }],
      ),
    ).toEqual([]);
  });

  it("keeps a bounded number", () => {
    const many = Array.from({ length: MAX_CORRECTIONS + 5 }, (_, i) => ({
      from: `w${i}`,
      to: `x${i}`,
    }));

    const merged = mergeCorrections([], many);

    expect(merged).toHaveLength(MAX_CORRECTIONS);
    expect(merged[0]).toEqual({
      from: `w${MAX_CORRECTIONS + 4}`,
      to: `x${MAX_CORRECTIONS + 4}`,
    });
  });
});

describe("applyCorrections", () => {
  it("replaces whole words whatever their case, keeping punctuation and spacing", () => {
    expect(
      applyCorrections("Sugar Bush, then a bushy  bush.", [
        { from: "bush", to: "push" },
      ]),
    ).toBe("Sugar push, then a bushy  push.");
  });

  it("matches phrases across words, longer ones first", () => {
    expect(
      applyCorrections("The and core step. And core!", [
        { from: "core", to: "x" },
        { from: "and core", to: "anchor" },
      ]),
    ).toBe("The anchor step. anchor!");
  });

  it("leaves text without a match alone", () => {
    expect(applyCorrections("A whip.", [])).toBe("A whip.");
    expect(applyCorrections("A whip.", [{ from: "bush", to: "push" }])).toBe(
      "A whip.",
    );
  });

  it("corrects every line of a transcript", () => {
    const transcript = {
      language: "en",
      model: "whisper-base-q5_1",
      createdAt: 1,
      segments: [
        { start: 0, end: 2, text: "A sugar bush." },
        { start: 2, end: 4, text: "Another sugar bush." },
      ],
    };

    expect(
      applyLearnedCorrections(transcript, [
        { from: "bush", to: "push" },
      ]).segments.map((s) => s.text),
    ).toEqual(["A sugar push.", "Another sugar push."]);
  });
});
