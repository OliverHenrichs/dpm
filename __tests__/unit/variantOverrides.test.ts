import {
  compactOverrides,
  editOverrides,
  effectiveVariant,
  overrideTiming,
  ownFields,
  parseOverrides,
  prunedVariantOverrides,
  resetOverride,
} from "@/src/pattern/types/VariantOverrides";
import { IPatternModifierRef } from "@/src/pattern/types/IPatternList";

// A variant's own values in place of its figure's (#134).

const whip = {
  counts: 8,
  rhythm: "1 2 3&4 5 6 7&8",
  level: "beginner",
  description: "Pulls the follower through.",
};
const telemark = (
  overrides?: IPatternModifierRef["overrides"],
): IPatternModifierRef => ({
  modifierId: "telemark",
  videoRefs: [],
  ...(overrides && { overrides }),
});

describe("effectiveVariant", () => {
  it("is the figure's values without overrides", () => {
    expect(effectiveVariant(whip)).toEqual(whip);
    expect(effectiveVariant(whip, telemark())).toEqual(whip);
  });

  it("takes each override in place of the figure's value", () => {
    expect(
      effectiveVariant(
        whip,
        telemark({ level: "advanced", description: "With a Telemark." }),
      ),
    ).toEqual({ ...whip, level: "advanced", description: "With a Telemark." });
  });

  it("takes counts and rhythm together: own counts without a rhythm have none", () => {
    expect(effectiveVariant(whip, telemark({ counts: 6 }))).toEqual({
      counts: 6,
      level: "beginner",
      description: whip.description,
    });
    expect(
      effectiveVariant(whip, telemark({ counts: 4, rhythm: "S Q Q" })),
    ).toMatchObject({ counts: 4, rhythm: "S Q Q" });
  });

  it("keeps an empty description of its own", () => {
    expect(
      effectiveVariant(whip, telemark({ description: "" })).description,
    ).toBe("");
  });
});

describe("compactOverrides", () => {
  it("keeps only what differs from the figure, and nothing when nothing does", () => {
    expect(
      compactOverrides(whip, {
        counts: 8,
        rhythm: "1 2 3&4 5 6 7&8",
        level: "beginner",
        description: whip.description,
      }),
    ).toBeUndefined();
    expect(compactOverrides(whip, {})).toBeUndefined();
    expect(compactOverrides(whip, undefined)).toBeUndefined();
    expect(
      compactOverrides(whip, {
        level: "advanced",
        counts: 8,
        rhythm: whip.rhythm,
      }),
    ).toEqual({
      level: "advanced",
    });
  });

  it("keeps the figure's counts beside a rhythm of the variant's own", () => {
    expect(
      compactOverrides(whip, { counts: 8, rhythm: "1 2 3 4 5 6 7 8" }),
    ).toEqual({ counts: 8, rhythm: "1 2 3 4 5 6 7 8" });
    // The figure's counts with no rhythm: the variant has none where the figure has one.
    expect(compactOverrides(whip, { counts: 8 })).toEqual({ counts: 8 });
  });

  it("never holds a rhythm without counts, nor an undefined", () => {
    const out = compactOverrides(whip, {
      rhythm: "S Q Q",
      level: undefined,
      description: undefined,
    });
    expect(out).toBeUndefined();
  });
});

describe("editing a variant's overrides", () => {
  it("sets an override, and an edit back to the figure's value removes it", () => {
    const own = editOverrides(whip, telemark(), (o) => ({
      ...o,
      level: "advanced",
    }));
    expect(own.overrides).toEqual({ level: "advanced" });
    const back = editOverrides(whip, own, (o) => ({ ...o, level: "beginner" }));
    expect(back).toEqual(telemark());
    expect(back).not.toHaveProperty("overrides");
  });

  it("sets counts and rhythm together", () => {
    const own = overrideTiming(whip, telemark({ level: "advanced" }), {
      counts: 6,
      rhythm: "1 2 3&4&5 6",
    });
    expect(own.overrides).toEqual({
      level: "advanced",
      counts: 6,
      rhythm: "1 2 3&4&5 6",
    });
    expect(
      overrideTiming(whip, own, { counts: 8, rhythm: whip.rhythm }),
    ).toEqual(telemark({ level: "advanced" }));
  });

  it("resets one field and keeps the others", () => {
    const ref = telemark({
      counts: 6,
      rhythm: "1 2 3&4&5 6",
      level: "advanced",
      description: "With a Telemark.",
    });
    expect(resetOverride(whip, ref, "timing").overrides).toEqual({
      level: "advanced",
      description: "With a Telemark.",
    });
    expect(resetOverride(whip, ref, "level").overrides).toEqual({
      counts: 6,
      rhythm: "1 2 3&4&5 6",
      description: "With a Telemark.",
    });
    expect(
      resetOverride(whip, telemark({ description: "x" }), "description"),
    ).toEqual(telemark());
  });

  it("marks only the fields that differ", () => {
    expect(ownFields(whip, telemark())).toEqual({
      counts: false,
      rhythm: false,
      level: false,
      description: false,
    });
    expect(
      ownFields(whip, telemark({ counts: 8, rhythm: "1 2 3 4 5 6 7 8" })),
    ).toEqual({
      counts: false,
      rhythm: true,
      level: false,
      description: false,
    });
    expect(ownFields(whip, telemark({ counts: 6, level: "x" }))).toEqual({
      counts: true,
      rhythm: true,
      level: true,
      description: false,
    });
  });

  it("prunes overrides the figure has come to match", () => {
    const figure = {
      ...whip,
      level: "advanced",
      modifierRefs: [telemark({ level: "advanced", description: "Own." })],
    };
    expect(prunedVariantOverrides(figure).modifierRefs).toEqual([
      telemark({ description: "Own." }),
    ]);
  });
});

describe("parseOverrides", () => {
  it("keeps valid overrides, normalising a rhythm", () => {
    expect(
      parseOverrides({
        counts: 4,
        rhythm: " s q  q",
        level: "advanced",
        description: "With a Telemark.",
      }),
    ).toEqual({
      overrides: {
        counts: 4,
        rhythm: "S Q Q",
        level: "advanced",
        description: "With a Telemark.",
      },
      rhythmDropped: false,
    });
  });

  it.each([
    ["not an object", "counts: 6"],
    ["an array", [6]],
    ["null", null],
    ["counts of zero", { counts: 0 }],
    ["fractional counts", { counts: 2.5 }],
    ["counts as text", { counts: "6" }],
    ["an empty level", { level: "" }],
    ["a level that is not text", { level: 3 }],
    ["a description that is not text", { description: 7 }],
  ])("drops %s, and the whole when nothing is left", (_label, raw) => {
    expect(parseOverrides(raw)).toEqual({ rhythmDropped: false });
  });

  it("keeps a rhythm with quick subdivisions and holds, counted by whole beats", () => {
    expect(parseOverrides({ counts: 3, rhythm: "1 2  3&(a)" })).toEqual({
      overrides: { counts: 3, rhythm: "1 2 3&(a)" },
      rhythmDropped: false,
    });
    expect(parseOverrides({ counts: 4, rhythm: "1 2 3& 4" })).toEqual({
      overrides: { counts: 4 },
      rhythmDropped: true,
    });
  });

  it("drops a rhythm without counts it matches, and says so", () => {
    expect(parseOverrides({ counts: 6, rhythm: "S Q Q" })).toEqual({
      overrides: { counts: 6 },
      rhythmDropped: true,
    });
    expect(parseOverrides({ rhythm: "S Q Q" })).toEqual({
      rhythmDropped: true,
    });
    expect(
      parseOverrides({ counts: 200, rhythm: "1 ".repeat(200).trim() + " 201" })
        .rhythmDropped,
    ).toBe(true);
  });

  it("keeps only a level the list has, when told its levels", () => {
    expect(parseOverrides({ level: "nope" }, ["beginner"])).toEqual({
      rhythmDropped: false,
    });
    expect(
      parseOverrides({ level: "beginner" }, ["beginner"]).overrides,
    ).toEqual({ level: "beginner" });
  });

  it("cuts a long description", () => {
    expect(
      parseOverrides({ description: "x".repeat(5000) }).overrides?.description,
    ).toHaveLength(2000);
  });
});
