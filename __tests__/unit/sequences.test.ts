import {
  cleanSequence,
  duplicateStep,
  figureStep,
  formatMark,
  freeStep,
  freeStepsOf,
  loopWindow,
  markQueue,
  markStart,
  MAX_SEQUENCE_STEPS,
  MAX_SEQUENCES,
  MAX_STEP_TEXT,
  moveStep,
  roundMark,
  stepAtTime,
  withMark,
  withSequenceVideo,
  sequencesUsing,
  sequenceTotals,
  stepCounts,
  stepPickerGroups,
  stepVariant,
  stepVariants,
  withoutVariant,
  withSequences,
} from "@/src/pattern/sequences/sequences";
import { normalizeList } from "@/src/pattern/data/validation/normalizeList";
import { ImportMessage } from "@/src/pattern/data/validation/importMessages";
import {
  IModifier,
  IPattern,
  ISequence,
  ISequenceStep,
} from "@/src/pattern/types/IPatternList";
import {
  createTestPattern,
  createTestPatternList,
  createTestPatternType,
} from "@/utils/testFactories";

const PUSH = createTestPatternType({ slug: "push" });
const PASS = createTestPatternType({ slug: "pass" });
const WHIP = createTestPatternType({ slug: "whip" });

const insideTurn: IModifier = {
  id: "inside",
  name: "with Inside Turn",
  position: "amends",
  universal: false,
  videoRefs: [],
};
const freeSpin: IModifier = {
  id: "spin",
  name: "with Free Spin",
  position: "amends",
  universal: false,
  videoRefs: [],
};
const hesitation: IModifier = {
  id: "hesitation",
  name: "Hesitation",
  position: "amends",
  universal: true,
  videoRefs: [],
};
const modifiers = [insideTurn, freeSpin, hesitation];

const sugarPush = createTestPattern(PUSH.id, {
  id: 1,
  name: "Sugar Push",
  counts: 6,
});
const leftSidePass = createTestPattern(PASS.id, {
  id: 2,
  name: "Left Side Pass",
  counts: 6,
  modifierRefs: [{ modifierId: "inside", videoRefs: [] }],
});
const basicWhip = createTestPattern(WHIP.id, {
  id: 3,
  name: "Basic Whip",
  counts: 8,
  // A variant with counts of its own (#134).
  modifierRefs: [
    { modifierId: "inside", videoRefs: [], overrides: { counts: 10 } },
  ],
});
const patterns = [sugarPush, leftSidePass, basicWhip];

const step = (patternId: number, modifierId?: string): ISequenceStep => ({
  kind: "figure",
  id: `s${patternId}${modifierId ?? ""}`,
  patternId,
  ...(modifierId && { modifierId }),
});

const sequence = (
  steps: ISequenceStep[],
  overrides: Partial<ISequence> = {},
): ISequence => ({
  id: "seq",
  name: "Rallye 2026",
  steps,
  createdAt: 1,
  ...overrides,
});

describe("variants of a step", () => {
  it("offers the figure's attached modifiers, then the universal ones", () => {
    expect(stepVariants(leftSidePass, modifiers)).toEqual([
      insideTurn,
      hesitation,
    ]);
    expect(stepVariants(sugarPush, modifiers)).toEqual([hesitation]);
  });

  it("is the plain figure when the variant is not one the figure has", () => {
    const s = step(1, "inside") as Extract<ISequenceStep, { kind: "figure" }>;
    expect(stepVariant(s, sugarPush, modifiers)).toBeUndefined();
    expect(stepCounts(s, patterns, modifiers)).toBe(6);
  });
});

describe("counts", () => {
  it("takes a step's counts from its figure, or its variant's own", () => {
    expect(stepCounts(step(3), patterns, modifiers)).toBe(8);
    expect(stepCounts(step(3, "inside"), patterns, modifiers)).toBe(10);
    // A universal modifier never has counts of its own.
    expect(stepCounts(step(3, "hesitation"), patterns, modifiers)).toBe(8);
  });

  it("follows the figure when its counts change", () => {
    const longer = [{ ...sugarPush, counts: 8 }, leftSidePass, basicWhip];
    expect(stepCounts(step(1), longer, modifiers)).toBe(8);
  });

  it("takes a free step's own, and none for a figure gone from the list", () => {
    expect(stepCounts(freeStep("pose", 2), patterns, modifiers)).toBe(2);
    expect(stepCounts(freeStep("pose"), patterns, modifiers)).toBeUndefined();
    expect(stepCounts(step(99), patterns, modifiers)).toBeUndefined();
  });

  it("adds up steps and counts", () => {
    const steps = [step(1), step(2, "inside"), freeStep("pose", 2), step(3)];
    expect(sequenceTotals(steps, patterns, modifiers, "wcs")).toEqual({
      steps: 4,
      counts: 22,
    });
  });

  it("shows eights for a dance counted in eights, when every step fills whole eights", () => {
    const salsa = [
      createTestPattern(PUSH.id, { id: 1, name: "Basic Step", counts: 8 }),
      createTestPattern(PUSH.id, { id: 2, name: "Cross Body Lead", counts: 8 }),
      createTestPattern(PUSH.id, { id: 3, name: "Right Turn", counts: 16 }),
    ];
    const steps = [step(1), step(2), step(3), freeStep("pose")];
    expect(sequenceTotals(steps, salsa, [], "salsa")).toEqual({
      steps: 4,
      counts: 32,
      eights: 4,
    });
    // A step of four counts: only the counts.
    expect(
      sequenceTotals([...steps, freeStep("break", 4)], salsa, [], "salsa"),
    ).toEqual({ steps: 5, counts: 36 });
    // Not a dance counted in eights, or no dance at all.
    expect(sequenceTotals(steps, salsa, [], "wcs").eights).toBeUndefined();
    expect(sequenceTotals(steps, salsa, []).eights).toBeUndefined();
  });
});

describe("deleting a figure or a modifier", () => {
  const routine = sequence([
    { ...step(2, "inside"), note: "slow" },
    step(1),
    step(2),
  ]);
  const other = sequence([step(1)], { id: "other", name: "Workshop combo" });

  it("names the sequences that use a figure", () => {
    expect(sequencesUsing([routine, other], 2)).toEqual([routine]);
    expect(sequencesUsing([routine, other], 1)).toEqual([routine, other]);
    expect(sequencesUsing(undefined, 1)).toEqual([]);
  });

  it("turns the figure's steps into free steps with its name, keeping their place", () => {
    const [freed, untouched] = freeStepsOf(
      [routine, other],
      leftSidePass,
      modifiers,
    )!;
    expect(freed.steps).toEqual([
      {
        kind: "free",
        id: routine.steps[0].id,
        text: "Left Side Pass (with Inside Turn)",
        counts: 6,
        note: "slow",
      },
      routine.steps[1],
      {
        kind: "free",
        id: routine.steps[2].id,
        text: "Left Side Pass",
        counts: 6,
      },
    ]);
    expect(untouched).toBe(other);
  });

  it("changes nothing when no sequence uses the figure", () => {
    const sequences = [other];
    expect(freeStepsOf(sequences, basicWhip, modifiers)).toBe(sequences);
  });

  it("makes a step danced with a deleted modifier the plain figure", () => {
    const [after] = withoutVariant([routine], "inside")!;
    expect(after.steps[0]).toEqual({
      kind: "figure",
      id: routine.steps[0].id,
      patternId: 2,
      note: "slow",
    });
  });
});

describe("saving", () => {
  it("trims, drops what is empty, and a variant the figure no longer has", () => {
    const cleaned = cleanSequence(
      {
        id: "seq",
        name: "  Rallye 2026 ",
        description: "  ",
        createdAt: 1,
        steps: [
          {
            kind: "figure",
            id: "a",
            patternId: 1,
            modifierId: "inside",
            note: " ",
          },
          { kind: "free", id: "b", text: " pose ", counts: 0, note: " hold " },
        ],
      },
      patterns,
      modifiers,
    );
    expect(cleaned).toEqual({
      id: "seq",
      name: "Rallye 2026",
      createdAt: 1,
      steps: [
        { kind: "figure", id: "a", patternId: 1 },
        { kind: "free", id: "b", text: "pose", note: "hold" },
      ],
    });
  });

  it("keeps at most the cap of steps, and cuts a long free step", () => {
    const many = Array.from({ length: MAX_SEQUENCE_STEPS + 5 }, (_, i) => ({
      ...freeStep("x".repeat(MAX_STEP_TEXT + 10)),
      id: `f${i}`,
    }));
    const cleaned = cleanSequence(sequence(many), patterns, modifiers);
    expect(cleaned.steps).toHaveLength(MAX_SEQUENCE_STEPS);
    expect((cleaned.steps[0] as { text: string }).text).toHaveLength(
      MAX_STEP_TEXT,
    );
  });

  it("leaves the key off a list without sequences", () => {
    const list = createTestPatternList({ sequences: [sequence([])] });
    expect(withSequences(list, [])).not.toHaveProperty("sequences");
    expect(withSequences(list, undefined)).not.toHaveProperty("sequences");
    expect(withSequences(list, [sequence([])]).sequences).toHaveLength(1);
  });
});

describe("editing steps", () => {
  const steps = [step(1), step(2), step(3)];

  it("moves a step", () => {
    expect(moveStep(steps, 0, 2).map((s) => s.id)).toEqual(["s2", "s3", "s1"]);
    expect(moveStep(steps, 2, 0).map((s) => s.id)).toEqual(["s3", "s1", "s2"]);
    expect(moveStep(steps, 0, 5)).toEqual(steps);
  });

  it("duplicates a step right after itself, under a new id", () => {
    const after = duplicateStep(steps, 0);
    expect(after.map((s) => (s as { patternId: number }).patternId)).toEqual([
      1, 1, 2, 3,
    ]);
    expect(after[1].id).not.toBe(after[0].id);
  });

  it("does not duplicate past the cap", () => {
    const full = Array.from({ length: MAX_SEQUENCE_STEPS }, (_, i) => ({
      ...figureStep(1),
      id: `f${i}`,
    }));
    expect(duplicateStep(full, 0)).toHaveLength(MAX_SEQUENCE_STEPS);
  });
});

describe("the step picker", () => {
  it("groups the figures by type in the list's order, by name within one", () => {
    const groups = stepPickerGroups(patterns, [WHIP, PASS, PUSH], "");
    expect(
      groups.map((g) => [g.type?.slug, g.patterns.map((p) => p.name)]),
    ).toEqual([
      ["whip", ["Basic Whip"]],
      ["pass", ["Left Side Pass"]],
      ["push", ["Sugar Push"]],
    ]);
  });

  it("narrows them fuzzily, and puts a figure of an unknown type last", () => {
    const stray = createTestPattern("gone", { id: 4, name: "Sugar Tuck" });
    const groups = stepPickerGroups(
      [...patterns, stray],
      [PUSH, PASS, WHIP],
      "sugr",
    );
    expect(groups.map((g) => g.patterns.map((p) => p.name))).toEqual([
      ["Sugar Push"],
      ["Sugar Tuck"],
    ]);
    expect(groups[1].type).toBeUndefined();
  });
});

describe("repairs on import and from the cloud (normalizeList)", () => {
  const raw = (sequences: unknown) => ({
    ...createTestPatternList({
      name: "WCS",
      patternTypes: [PUSH, PASS, WHIP],
      modifiers,
    }),
    patterns: patterns as IPattern[],
    sequences,
  });
  const normalize = (sequences: unknown) => {
    const errors: ImportMessage[] = [];
    const warnings: ImportMessage[] = [];
    const list = normalizeList(raw(sequences), 0, errors, warnings);
    return { list, errors, warnings: warnings.map((w) => w.key) };
  };

  it("keeps well-formed sequences as they are", () => {
    const seq = sequence([step(2, "inside"), freeStep("pose", 2), step(3)]);
    const { list, warnings, errors } = normalize([seq]);
    expect(list?.sequences).toEqual([seq]);
    expect(warnings).toEqual([]);
    expect(errors).toEqual([]);
  });

  it("drops a sequence without an id or a name, or seen before", () => {
    const { list, warnings } = normalize([
      sequence([], { id: "a" }),
      sequence([], { id: "a", name: "Again" }),
      { name: "No id", steps: [] },
      sequence([], { id: "b", name: "  " }),
      "junk",
    ]);
    expect(list?.sequences?.map((s) => s.id)).toEqual(["a"]);
    expect(warnings).toEqual(Array(4).fill("importWarnSequenceMalformed"));
  });

  it("drops malformed steps, counted apart from missing figures", () => {
    const { list, warnings } = normalize([
      sequence([
        step(1),
        step(1),
        { kind: "free", id: "f", text: "  " } as ISequenceStep,
        { kind: "jump", id: "j" } as unknown as ISequenceStep,
        step(42),
      ]),
    ]);
    expect(list?.sequences?.[0].steps).toEqual([step(1)]);
    expect(warnings).toEqual([
      "importWarnSequenceStepsMissingFigure",
      "importWarnSequenceStepsMalformed",
    ]);
  });

  it("keeps at most the caps, and says so", () => {
    const tooMany = Array.from({ length: MAX_SEQUENCES + 2 }, (_, i) =>
      sequence([], { id: `q${i}`, name: `Q${i}` }),
    );
    const long = sequence(
      Array.from({ length: MAX_SEQUENCE_STEPS + 1 }, (_, i) => ({
        ...step(1),
        id: `l${i}`,
      })),
    );
    expect(normalize(tooMany).list?.sequences).toHaveLength(MAX_SEQUENCES);
    expect(normalize(tooMany).warnings).toEqual(["importWarnTooManySequences"]);
    expect(normalize([long]).list?.sequences?.[0].steps).toHaveLength(
      MAX_SEQUENCE_STEPS,
    );
    expect(normalize([long]).warnings).toEqual(["importWarnSequenceTooLong"]);
  });

  it("drops the key when nothing is left, and says so when it is not a list", () => {
    expect(normalize(undefined).list).not.toHaveProperty("sequences");
    expect(normalize([]).list).not.toHaveProperty("sequences");
    expect(normalize("routine").list).not.toHaveProperty("sequences");
    expect(normalize("routine").warnings).toEqual([
      "importWarnSequencesNotList",
    ]);
  });
});

describe("video mapping", () => {
  const marks = (...ats: (number | undefined)[]): ISequenceStep[] =>
    ats.map((at, i) => ({
      kind: "free",
      id: `m${i}`,
      text: `step ${i}`,
      ...(at !== undefined && { at }),
    }));
  const video = { type: "url" as const, value: "https://youtu.be/abc" };

  it("finds the step playing: the latest mark passed, a little early counting", () => {
    const steps = marks(0, 4, undefined, 9);
    expect(stepAtTime(steps, 0)).toBe(0);
    expect(stepAtTime(steps, 3.85)).toBe(0);
    expect(stepAtTime(steps, 3.95)).toBe(1);
    expect(stepAtTime(steps, 8)).toBe(1);
    expect(stepAtTime(steps, 60)).toBe(3);
    expect(stepAtTime(marks(2), 1)).toBe(-1);
    // Marks out of order: the latest passed wins, wherever it is in the list.
    expect(stepAtTime(marks(5, 1), 6)).toBe(0);
  });

  it("loops a step from its mark to the next later one, or to the end", () => {
    const steps = marks(0, 4, undefined, 9);
    expect(loopWindow(steps, 0)).toEqual({ start: 0, end: 4 });
    expect(loopWindow(steps, 1)).toEqual({ start: 4, end: 9 });
    expect(loopWindow(steps, 3)).toEqual({ start: 9 });
    expect(loopWindow(steps, 2)).toBeNull();
  });

  it("marks the unmarked steps, or all of them again, from where the marked ones end", () => {
    const partly = marks(0, 4, undefined, undefined);
    expect(markQueue(partly)).toEqual(["m2", "m3"]);
    expect(markStart(partly, markQueue(partly))).toBe(4);
    const all = marks(0, 4);
    expect(markQueue(all)).toEqual(["m0", "m1"]);
    expect(markStart(all, markQueue(all))).toBe(0);
    expect(markStart(marks(undefined), ["m0"])).toBe(0);
  });

  it("shows a mark as m:ss with tenths, and stores it to the hundredth", () => {
    expect(formatMark(0)).toBe("0:00.0");
    expect(formatMark(62.5)).toBe("1:02.5");
    expect(formatMark(59.96)).toBe("1:00.0");
    expect(roundMark(3.14159)).toBe(3.14);
    expect(roundMark(-2)).toBe(0);
    expect(withMark(marks(1)[0], 2.345)).toMatchObject({ at: 2.35 });
    expect(withMark(marks(1)[0], undefined)).not.toHaveProperty("at");
  });

  it("drops the marks with the video", () => {
    const marked = sequence(marks(0, 4), { video });
    expect(withSequenceVideo(marked, video)).toEqual(marked);
    const without = withSequenceVideo(marked, undefined);
    expect(without).not.toHaveProperty("video");
    without.steps.forEach((s) => expect(s).not.toHaveProperty("at"));
  });

  it("saves the video and rounded marks, and no marks without a video", () => {
    const steps: ISequenceStep[] = [{ ...step(1), at: 1.234 }];
    expect(
      cleanSequence(sequence(steps, { video }), patterns, modifiers),
    ).toEqual(sequence([{ ...step(1), at: 1.23 }], { video }));
    expect(cleanSequence(sequence(steps), patterns, modifiers).steps).toEqual([
      step(1),
    ]);
  });

  it("does not copy a mark onto a duplicate, and keeps it on a freed step", () => {
    const steps: ISequenceStep[] = [{ ...step(1), at: 3 }];
    expect(duplicateStep(steps, 0)[1]).not.toHaveProperty("at");
    const [freed] = freeStepsOf(
      [sequence(steps, { video })],
      sugarPush,
      modifiers,
    )!;
    expect(freed.steps[0]).toMatchObject({ kind: "free", at: 3 });
  });

  it("keeps marks and the video on import, and drops a bad mark quietly", () => {
    const warnings: ImportMessage[] = [];
    const list = normalizeList(
      {
        ...createTestPatternList({
          patternTypes: [PUSH, PASS, WHIP],
          modifiers,
        }),
        patterns,
        sequences: [
          sequence(
            [
              { ...step(1), at: 2 },
              { ...step(2), id: "x", at: -1 },
            ],
            {
              video,
            },
          ),
        ],
      },
      0,
      [],
      warnings,
    );
    expect(list?.sequences?.[0]).toEqual(
      sequence(
        [
          { ...step(1), at: 2 },
          { ...step(2), id: "x" },
        ],
        { video },
      ),
    );
    expect(warnings).toEqual([]);
  });
});
