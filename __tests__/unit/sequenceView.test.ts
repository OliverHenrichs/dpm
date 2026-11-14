import {
  countSequenceFilters,
  EMPTY_SEQUENCE_FILTER,
  filterSequences,
  sortSequences,
} from "@/src/pattern/sequences/sequenceView";
import { ISequence } from "@/src/pattern/types/IPatternList";
import {
  createTestPattern,
  createTestPatternType,
} from "@/utils/testFactories";

const push = createTestPatternType({ slug: "push" });
const sugarPush = createTestPattern(push.id, {
  id: 1,
  name: "Sugar Push",
  counts: 6,
});
const whip = createTestPattern(push.id, {
  id: 2,
  name: "Basic Whip",
  counts: 8,
});
const patterns = [sugarPush, whip];

const figure = (patternId: number, id: string) =>
  ({ kind: "figure", id, patternId }) as const;

function sequence(
  name: string,
  createdAt: number,
  patternIds: number[],
  withVideo = false,
): ISequence {
  return {
    id: name,
    name,
    createdAt,
    steps: patternIds.map((p, i) => figure(p, `${name}-${i}`)),
    ...(withVideo && { video: { type: "url", value: "https://x.test/v" } }),
  };
}

// Stored out of creation order on purpose.
const routine = sequence("Workshop routine", 3, [1, 2, 1]); // 3 steps, 20 counts
const warmUp = sequence("Warm-up", 1, [2, 2], true); // 2 steps, 16 counts
const rallye = sequence("Rallye round", 2, [1, 1, 1, 1]); // 4 steps, 24 counts
const sequences = [routine, warmUp, rallye];

const names = (list: ISequence[]) => list.map((s) => s.name);
const sort = (
  field: "name" | "added" | "counts" | "steps",
  order: "asc" | "desc",
) => names(sortSequences(sequences, { field, order }, patterns, []));

describe("sortSequences", () => {
  it("sorts by date added from createdAt", () => {
    expect(sort("added", "asc")).toEqual([
      "Warm-up",
      "Rallye round",
      "Workshop routine",
    ]);
    expect(sort("added", "desc")).toEqual([
      "Workshop routine",
      "Rallye round",
      "Warm-up",
    ]);
  });

  it("sorts by name", () => {
    expect(sort("name", "asc")).toEqual([
      "Rallye round",
      "Warm-up",
      "Workshop routine",
    ]);
  });

  it("sorts by total counts, as the rows show them", () => {
    expect(sort("counts", "asc")).toEqual([
      "Warm-up",
      "Workshop routine",
      "Rallye round",
    ]);
  });

  it("sorts by number of steps", () => {
    expect(sort("steps", "desc")).toEqual([
      "Rallye round",
      "Workshop routine",
      "Warm-up",
    ]);
  });
});

describe("filterSequences", () => {
  it("lets everything through with an empty filter", () => {
    expect(filterSequences(sequences, EMPTY_SEQUENCE_FILTER, patterns)).toEqual(
      sequences,
    );
  });

  it("keeps sequences with a step of a figure matching part of its name", () => {
    expect(
      names(
        filterSequences(
          sequences,
          { ...EMPTY_SEQUENCE_FILTER, figure: "whip" },
          patterns,
        ),
      ),
    ).toEqual(["Workshop routine", "Warm-up"]);
  });

  it("combines name and video", () => {
    expect(
      names(
        filterSequences(
          sequences,
          { name: "w", figure: "", withVideo: true },
          patterns,
        ),
      ),
    ).toEqual(["Warm-up"]);
  });

  it("counts each criterion that is set", () => {
    expect(countSequenceFilters(EMPTY_SEQUENCE_FILTER)).toBe(0);
    expect(
      countSequenceFilters({ name: "", figure: "push", withVideo: true }),
    ).toBe(2);
  });
});
