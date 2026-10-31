import {
  addTypeMove,
  applyTypeMoves,
  countAfterMoves,
  countPatternsByType,
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
