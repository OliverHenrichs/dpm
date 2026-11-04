import {
  badgeLabel,
  hopPath,
  sequenceOverlay,
} from "@/src/pattern/graph/model/sequenceOverlay";
import { ISequence, ISequenceStep } from "@/src/pattern/types/IPatternList";
import { NODE_HEIGHT, NODE_WIDTH } from "@/src/pattern/graph/types/Constants";

const fig = (id: string, patternId: number): ISequenceStep => ({
  kind: "figure",
  id,
  patternId,
});
const free = (id: string): ISequenceStep => ({
  kind: "free",
  id,
  text: "pose",
});
const seq = (steps: ISequenceStep[]): ISequence => ({
  id: "s",
  name: "Rallye",
  createdAt: 1,
  steps,
});
const all = new Set([1, 2, 3, 4]);

describe("sequenceOverlay", () => {
  it("numbers the figures by their step, free steps counted, as on the List tab", () => {
    const { numbers } = sequenceOverlay(
      seq([fig("a", 1), free("b"), fig("c", 2), fig("d", 1)]),
      all,
    );

    expect(numbers).toEqual(
      new Map([
        [1, [1, 4]],
        [2, [3]],
      ]),
    );
  });

  it("draws an arrow from each figure to the next, across free steps", () => {
    const { hops } = sequenceOverlay(
      seq([fig("a", 1), free("b"), fig("c", 2), fig("d", 3)]),
      all,
    );

    expect(hops).toEqual([
      { from: 1, to: 2 },
      { from: 2, to: 3 },
    ]);
  });

  it("passes over a figure the filter hides, numbering only what is drawn", () => {
    const { numbers, hops } = sequenceOverlay(
      seq([fig("a", 1), fig("b", 2), fig("c", 3)]),
      new Set([1, 3]),
    );

    expect([...numbers.keys()]).toEqual([1, 3]);
    expect(numbers.get(3)).toEqual([3]);
    expect(hops).toEqual([{ from: 1, to: 3 }]);
  });

  it("draws no arrow onto the same figure danced twice in a row", () => {
    const { numbers, hops } = sequenceOverlay(
      seq([fig("a", 1), fig("b", 1), fig("c", 2)]),
      all,
    );

    expect(numbers.get(1)).toEqual([1, 2]);
    expect(hops).toEqual([{ from: 1, to: 2 }]);
  });

  it("draws a pair danced twice the same way once, and back the other way too", () => {
    const { hops } = sequenceOverlay(
      seq([fig("a", 1), fig("b", 2), fig("c", 1), fig("d", 2)]),
      all,
    );

    expect(hops).toEqual([
      { from: 1, to: 2 },
      { from: 2, to: 1 },
    ]);
  });

  it("draws nothing for a sequence of free steps, or of figures that are all hidden", () => {
    expect(sequenceOverlay(seq([free("a")]), all).hops).toEqual([]);
    const hidden = sequenceOverlay(seq([fig("a", 1), fig("b", 2)]), new Set());
    expect(hidden.numbers.size).toBe(0);
    expect(hidden.hops).toEqual([]);
  });
});

describe("badgeLabel", () => {
  it("joins up to three numbers and ends a longer run in an ellipsis", () => {
    expect(badgeLabel([2])).toBe("2");
    expect(badgeLabel([1, 4])).toBe("1 · 4");
    expect(badgeLabel([1, 4, 7])).toBe("1 · 4 · 7");
    expect(badgeLabel([1, 4, 7, 9])).toBe("1 · 4 · 7 …");
  });
});

describe("hopPath", () => {
  const ends = (d: string) => {
    const n = d.match(/-?\d+(\.\d+)?/g)!.map(Number);
    return {
      start: { x: n[0], y: n[1] },
      control: { x: n[2], y: n[3] },
      end: { x: n[4], y: n[5] },
    };
  };
  const outside = (p: { x: number; y: number }, c: { x: number; y: number }) =>
    Math.abs(p.x - c.x) > NODE_WIDTH / 2 ||
    Math.abs(p.y - c.y) > NODE_HEIGHT / 2;

  it("starts and ends outside both boxes, leaving room for the arrowhead", () => {
    const a = { x: 0, y: 0 };
    const b = { x: 300, y: 40 };
    const { start, end } = ends(hopPath(a, b, 20)!);

    expect(outside(start, a)).toBe(true);
    expect(outside(end, b)).toBe(true);
    // The tip room is left in front of the target box.
    expect(Math.abs(end.x - b.x)).toBeGreaterThan(NODE_WIDTH / 2 + 20);
  });

  it("bends there and back to opposite sides, so the two arrows don't overlap", () => {
    const a = { x: 0, y: 0 };
    const b = { x: 300, y: 0 };
    const there = ends(hopPath(a, b, 20)!).control;
    const back = ends(hopPath(b, a, 20)!).control;

    expect(Math.sign(there.y)).toBe(-Math.sign(back.y));
    expect(there.y).not.toBe(0);
  });

  it("draws nothing between boxes that overlap", () => {
    expect(hopPath({ x: 0, y: 0 }, { x: 0, y: 0 }, 20)).toBeNull();
    expect(hopPath({ x: 0, y: 0 }, { x: 40, y: 10 }, 20)).toBeNull();
  });

  it("bends out past the side between boxes in one column, even stacked tight", () => {
    // The timeline stacks a lane's boxes 70 apart: 10 between them, and maybe more boxes
    // between two figures of one column.
    const a = { x: 0, y: 0 };
    const b = { x: 0, y: 70 };
    const { start, control, end } = ends(hopPath(a, b, 20)!);

    // The curve reaches half way to its control point: past the column's side.
    expect(Math.abs(control.x) / 2).toBeGreaterThan(NODE_WIDTH / 2);
    expect(outside(start, a) && outside(start, b)).toBe(true);
    expect(outside(end, a) && outside(end, b)).toBe(true);
  });

  it("bends out past the top or bottom between boxes in one row", () => {
    const { control } = ends(
      hopPath({ x: 0, y: 0 }, { x: NODE_WIDTH + 10, y: 0 }, 20)!,
    );

    expect(Math.abs(control.y) / 2).toBeGreaterThan(NODE_HEIGHT / 2);
  });
});
