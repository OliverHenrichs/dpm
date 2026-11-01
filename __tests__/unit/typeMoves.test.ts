import {
  addTypeMove,
  applyTypeMoves,
  countAfterMoves,
  countPatternsByLevel,
  countPatternsByType,
  applyLevelMoves,
  NO_LEVEL,
} from "@/src/pattern/list/typeMoves";
import { createTestPattern } from "@/utils/testFactories";

const patterns = [
  createTestPattern("push", { id: 1 }),
  createTestPattern("push", { id: 2 }),
  createTestPattern("pass", { id: 3 }),
  createTestPattern("whip", { id: 4 }),
];

describe("type moves", () => {
  it("counts the patterns of each type", () => {
    expect(countPatternsByType(patterns)).toEqual({
      push: 2,
      pass: 1,
      whip: 1,
    });
    expect(countPatternsByType([])).toEqual({});
  });

  it("sends a type's figures on when the type they moved to is removed too", () => {
    const once = addTypeMove({}, "push", "pass");
    expect(once).toEqual({ push: "pass" });
    expect(addTypeMove(once, "pass", "whip")).toEqual({
      push: "whip",
      pass: "whip",
    });
  });

  it("counts what a type holds once the moves are applied", () => {
    const usage = countPatternsByType(patterns);
    const moves = addTypeMove({}, "push", "pass");

    expect(countAfterMoves("pass", usage, moves)).toBe(3);
    expect(countAfterMoves("push", usage, moves)).toBe(0);
    expect(countAfterMoves("whip", usage, moves)).toBe(1);
    expect(countAfterMoves("new", usage, moves)).toBe(0);
  });

  it("reassigns the moved figures and leaves the rest alone", () => {
    const moved = applyTypeMoves(patterns, { push: "whip" });

    expect(moved.map((p) => p.typeId)).toEqual([
      "whip",
      "whip",
      "pass",
      "whip",
    ]);
    expect(moved[2]).toBe(patterns[2]);
  });

  it("hands back the same array when nothing moves, so nothing is written", () => {
    expect(applyTypeMoves(patterns, {})).toBe(patterns);
    expect(applyTypeMoves(patterns, { gone: "pass" })).toBe(patterns);
  });
});

describe("level moves", () => {
  const onLevels = [
    createTestPattern("push", { id: 1, level: "c1" }),
    createTestPattern("push", { id: 2, level: "c1" }),
    createTestPattern("push", { id: 3, level: "c2" }),
    createTestPattern("push", { id: 4, level: undefined }),
  ];

  it("counts the patterns on each level, leaving out those on none", () => {
    expect(countPatternsByLevel(onLevels)).toEqual({ c1: 2, c2: 1 });
  });

  it("moves a level's figures to another level", () => {
    const moved = applyLevelMoves(onLevels, { c1: "c2" });
    expect(moved.map((p) => p.level)).toEqual(["c2", "c2", "c2", undefined]);
    expect(moved[2]).toBe(onLevels[2]);
  });

  it("leaves them without a level by removing the key, not setting undefined", () => {
    const moved = applyLevelMoves(onLevels, { c1: NO_LEVEL });
    expect(moved[0]).not.toHaveProperty("level");
    expect(moved[1]).not.toHaveProperty("level");
    expect(moved[2].level).toBe("c2");
  });

  it("chains like types, also into no level", () => {
    const moves = addTypeMove(addTypeMove({}, "c1", "c2"), "c2", NO_LEVEL);
    expect(moves).toEqual({ c1: NO_LEVEL, c2: NO_LEVEL });
    expect(
      applyLevelMoves(onLevels, moves).every((p) => p.level === undefined),
    ).toBe(true);
  });

  it("counts a level emptied into no level as empty", () => {
    const usage = countPatternsByLevel(onLevels);
    expect(countAfterMoves("c1", usage, { c1: NO_LEVEL })).toBe(0);
    expect(countAfterMoves("c2", usage, { c1: "c2" })).toBe(3);
  });

  it("hands back the same array when nothing moves", () => {
    expect(applyLevelMoves(onLevels, {})).toBe(onLevels);
    expect(applyLevelMoves(onLevels, { gone: "c1" })).toBe(onLevels);
  });
});
