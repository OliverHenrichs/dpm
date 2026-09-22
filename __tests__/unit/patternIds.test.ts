import { nextPatternId } from "@/src/pattern/data/patternIds";
import { IPattern } from "@/src/pattern/types/IPatternList";
import {
  createTestPattern,
  createTestPatternList,
  createTestPatternType,
} from "@/utils/testFactories";

const TYPE = createTestPatternType({ slug: "push" });

const pattern = (id: number): IPattern =>
  createTestPattern(TYPE.id, { id, name: `P${id}` });

const list = (nextPatternId?: number) =>
  createTestPatternList({ patternTypes: [TYPE], nextPatternId });

describe("nextPatternId", () => {
  describe("with no high-water mark", () => {
    it("starts at one for an empty list", () => {
      expect(nextPatternId(list(), [])).toBe(1);
    });

    it("carries on past the highest id in use", () => {
      expect(nextPatternId(list(), [pattern(1), pattern(7)])).toBe(8);
    });

    it("behaves exactly as it did before the mark existed", () => {
      // Lists written by older builds have no mark and must not change
      // behaviour on load — only from their next write onwards.
      const patterns = [pattern(3), pattern(1), pattern(2)];

      expect(nextPatternId(list(), patterns)).toBe(4);
    });

    it("copes with no list at all", () => {
      expect(nextPatternId(null, [pattern(4)])).toBe(5);
      expect(nextPatternId(undefined, [])).toBe(1);
    });
  });

  describe("with a high-water mark", () => {
    it("uses it", () => {
      expect(nextPatternId(list(12), [pattern(1)])).toBe(12);
    });

    it("does not reuse an id after the highest pattern is deleted", () => {
      // The defect this exists for: delete 7, and the next pattern used to be
      // handed 7 again, inheriting anything keyed by that id.
      const beforeDelete = [pattern(1), pattern(7)];
      const mark = nextPatternId(list(), beforeDelete) + 1;

      expect(nextPatternId(list(mark), [pattern(1)])).toBe(9);
    });

    it("never hands out an id already in use, whatever the mark says", () => {
      // A mark lost to an old export or a hand-edited file cannot cause a
      // collision, because the patterns present are always consulted.
      expect(nextPatternId(list(2), [pattern(1), pattern(40)])).toBe(41);
    });

    it("ignores a mark that is not a whole number", () => {
      expect(nextPatternId(list(3.5), [pattern(1)])).toBe(2);
      expect(nextPatternId(list(NaN), [pattern(1)])).toBe(2);
    });

    it("ignores a negative mark", () => {
      expect(nextPatternId(list(-5), [])).toBe(1);
    });
  });

  describe("bad pattern data", () => {
    it("ignores an id that is not a whole number", () => {
      const patterns = [pattern(2), { ...pattern(3), id: NaN }];

      expect(nextPatternId(list(), patterns)).toBe(3);
    });

    it("still returns at least one when every id is unusable", () => {
      expect(nextPatternId(list(), [{ ...pattern(1), id: NaN }])).toBe(1);
    });
  });

  describe("as a sequence", () => {
    it("never repeats, however the patterns come and go", () => {
      // The property that matters: an id, once handed out, is never handed
      // out again for that list.
      let stored = list();
      let patterns: IPattern[] = [];
      const handedOut: number[] = [];

      for (let step = 0; step < 20; step++) {
        const id = nextPatternId(stored, patterns);
        handedOut.push(id);
        patterns.push(pattern(id));
        stored = list(id + 1);
        // Delete the highest every third step, which is what used to make an
        // id come back round.
        if (step % 3 === 2) {
          const highest = Math.max(...patterns.map((p) => p.id));
          patterns = patterns.filter((p) => p.id !== highest);
        }
      }

      expect(new Set(handedOut).size).toBe(handedOut.length);
    });
  });
});
