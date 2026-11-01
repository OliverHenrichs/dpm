import {
  applyLevelPreset,
  BUILT_IN_LEVEL_IDS,
  builtInLevels,
  IPatternLevel,
  levelName,
  levelNameErrors,
  newLevelId,
  nextLevelName,
  resolveLevelIds,
  resolveLevels,
  storedLevels,
} from "@/src/pattern/types/PatternLevel";

// Names the built-ins the way a German phone would, so a test can tell translation from data.
const t = (key: string) =>
  ({ beginner: "Anfänger", intermediate: "Mittel", advanced: "Experte" })[
    key
  ] ?? key;

const course: IPatternLevel[] = [
  { id: "c1", name: "1" },
  { id: "c2", name: "2" },
  { id: "c3", name: "3" },
  { id: "c4", name: "4" },
];

describe("resolveLevels", () => {
  it("gives a list without levels the three built-in ones, translated", () => {
    expect(resolveLevels(undefined, t)).toEqual([
      { id: "beginner", name: "Anfänger" },
      { id: "intermediate", name: "Mittel" },
      { id: "advanced", name: "Experte" },
    ]);
    // An empty array cannot be saved or imported; it means the same.
    expect(resolveLevels([], t)).toEqual(builtInLevels(t));
  });

  it("gives a list its own levels in their order", () => {
    expect(resolveLevels(course, t)).toEqual(course);
    expect(resolveLevelIds(course)).toEqual(["c1", "c2", "c3", "c4"]);
    expect(resolveLevelIds(undefined)).toEqual(BUILT_IN_LEVEL_IDS);
  });
});

describe("levelName", () => {
  it("names a figure's level in its list", () => {
    expect(levelName(undefined, "advanced", t)).toBe("Experte");
    expect(levelName(course, "c2", t)).toBe("2");
  });

  it("names nothing for no level or one the list does not have", () => {
    expect(levelName(course, undefined, t)).toBeUndefined();
    // A built-in id on a list with levels of its own: an older figure.
    expect(levelName(course, "beginner", t)).toBeUndefined();
    expect(levelName(undefined, "grandmaster", t)).toBeUndefined();
  });
});

describe("storedLevels", () => {
  it("stores nothing for the untouched built-ins, so they follow the language", () => {
    expect(storedLevels(builtInLevels(t), t)).toBeUndefined();
  });

  it("stores the levels once anything differs", () => {
    const renamed = builtInLevels(t).map((l, i) =>
      i === 2 ? { ...l, name: "Profi" } : l,
    );
    expect(storedLevels(renamed, t)).toEqual(renamed);
    const reordered = [...builtInLevels(t)].reverse();
    expect(storedLevels(reordered, t)).toEqual(reordered);
    expect(storedLevels(builtInLevels(t).slice(0, 2), t)).toHaveLength(2);
    expect(storedLevels(course, t)).toEqual(course);
  });
});

describe("applyLevelPreset", () => {
  it("renames the levels in place, so figures keep their position", () => {
    const numbered = applyLevelPreset(builtInLevels(t), "numbers", t);
    expect(numbered).toEqual([
      { id: "beginner", name: "1" },
      { id: "intermediate", name: "2" },
      { id: "advanced", name: "3" },
    ]);
    // And back again: the built-ins as they were, which store as nothing.
    const back = applyLevelPreset(numbered, "builtIn", t);
    expect(back).toEqual(builtInLevels(t));
    expect(storedLevels(back, t)).toBeUndefined();
  });

  it("keeps levels past the preset, never taking a level from a figure", () => {
    expect(applyLevelPreset(course, "builtIn", t)).toEqual([
      { id: "c1", name: "Anfänger" },
      { id: "c2", name: "Mittel" },
      { id: "c3", name: "Experte" },
      { id: "c4", name: "4" },
    ]);
  });

  it("adds new levels when the preset is longer", () => {
    const one = [{ id: "only", name: "All" }];
    const numbered = applyLevelPreset(one, "numbers", t);
    expect(numbered.map((l) => l.name)).toEqual(["1", "2", "3"]);
    expect(numbered[0].id).toBe("only");
    expect(new Set(numbered.map((l) => l.id)).size).toBe(3);
    // The built-in ids are taken only where nothing has them yet.
    const fromOne = applyLevelPreset(
      [{ id: "intermediate", name: "X" }],
      "builtIn",
      t,
    );
    expect(fromOne[0].id).toBe("intermediate");
    expect(fromOne[1].id).not.toBe("intermediate");
    expect(fromOne[2].id).toBe("advanced");
  });

  it("blanks the names for own names, keeping the ids", () => {
    expect(applyLevelPreset(course, "ownNames", t)).toEqual(
      course.map((l) => ({ ...l, name: "" })),
    );
    expect(applyLevelPreset([], "ownNames", t)).toEqual([
      { id: expect.any(String), name: "" },
    ]);
  });
});

describe("nextLevelName", () => {
  it("counts on when the levels are numbered", () => {
    expect(nextLevelName(course)).toBe("5");
    expect(nextLevelName([{ id: "a", name: " 1 " }])).toBe("2");
  });

  it("leaves the name to the user otherwise", () => {
    expect(nextLevelName([])).toBe("");
    expect(nextLevelName(builtInLevels(t))).toBe("");
    expect(
      nextLevelName([
        { id: "a", name: "1" },
        { id: "b", name: "3" },
      ]),
    ).toBe("");
  });
});

describe("newLevelId", () => {
  it("is unique and fits the rules' 32-character bound on a suggested level", () => {
    const ids = new Set(Array.from({ length: 50 }, newLevelId));
    expect(ids.size).toBe(50);
    for (const id of ids) expect(id).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe("levelNameErrors", () => {
  it("refuses empty names and names used twice, ignoring case and spaces", () => {
    expect(levelNameErrors(course)).toEqual({});
    expect(
      levelNameErrors([
        { id: "a", name: "  " },
        { id: "b", name: "Basic" },
        { id: "c", name: " basic " },
      ]),
    ).toEqual({ a: "empty", b: "duplicate", c: "duplicate" });
  });
});
