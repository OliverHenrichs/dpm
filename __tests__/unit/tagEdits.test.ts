import {
  addTagEdit,
  applyTagEdits,
  countTags,
  editTags,
  NO_TAG_EDITS,
} from "@/src/pattern/list/tagEdits";
import { createTestPattern } from "@/utils/testFactories";

const patterns = [
  createTestPattern("push", { id: 1, tags: ["Basic", "Spin"] }),
  createTestPattern("push", { id: 2, tags: ["Spin", "basic"] }),
  createTestPattern("pass", { id: 3, tags: ["Dip"] }),
  createTestPattern("whip", { id: 4, tags: [] }),
];

describe("tag edits", () => {
  it("counts each tag once per figure, ignoring case, sorted by name", () => {
    expect(
      countTags([["Spin", "Basic"], ["basic", "Spin"], ["Basic", "basic"], []]),
    ).toEqual([
      { tag: "Basic", count: 3 },
      { tag: "Spin", count: 2 },
    ]);
    expect(countTags([])).toEqual([]);
  });

  it("is a tag named like an object's own keys like any other", () => {
    const edits = addTagEdit(NO_TAG_EDITS, "constructor", "Built");
    expect(editTags(["constructor", "toString"], edits)).toEqual([
      "Built",
      "toString",
    ]);
    expect(countTags([["constructor"]])).toEqual([
      { tag: "constructor", count: 1 },
    ]);
  });

  it("renames a tag in place, whatever its spelling", () => {
    const edits = addTagEdit(NO_TAG_EDITS, "Basic", "Foundation");
    expect(editTags(["Spin", "basic", "Dip"], edits)).toEqual([
      "Spin",
      "Foundation",
      "Dip",
    ]);
  });

  it("merges into another tag without a figure having it twice, keeping the newer place", () => {
    const edits = addTagEdit(NO_TAG_EDITS, "Spin", "Basic");
    // Most recent first: the merged tag stays where the first of the two was.
    expect(editTags(["Spin", "Dip", "Basic"], edits)).toEqual(["Basic", "Dip"]);
    expect(editTags(["Basic", "Spin"], edits)).toEqual(["Basic"]);
  });

  it("deletes a tag from every figure", () => {
    const edits = addTagEdit(NO_TAG_EDITS, "spin", null);
    const result = applyTagEdits(patterns, edits);
    expect(result.map((p) => p.tags)).toEqual([
      ["Basic"],
      ["basic"],
      ["Dip"],
      [],
    ]);
  });

  it("carries a merged tag along when the tag it went into is renamed or deleted", () => {
    const merged = addTagEdit(NO_TAG_EDITS, "Spin", "Basic");
    const renamed = addTagEdit(merged, "Basic", "Foundation");
    expect(editTags(["Spin", "Dip"], renamed)).toEqual(["Foundation", "Dip"]);
    expect(editTags(["basic"], renamed)).toEqual(["Foundation"]);
    const deleted = addTagEdit(merged, "Basic", null);
    expect(editTags(["Spin", "Basic", "Dip"], deleted)).toEqual(["Dip"]);
  });

  it("keeps a tag renamed away apart from the tag that took its name", () => {
    // Push becomes Pull; Whip then takes the free name Push, and is renamed again.
    let edits = addTagEdit(NO_TAG_EDITS, "Push", "Pull");
    edits = addTagEdit(edits, "Whip", "Push");
    edits = addTagEdit(edits, "Push", "Sling");
    expect(editTags(["Push"], edits)).toEqual(["Pull"]);
    expect(editTags(["Whip"], edits)).toEqual(["Sling"]);
  });

  it("can change only a tag's spelling", () => {
    const edits = addTagEdit(NO_TAG_EDITS, "basic", "BASIC");
    expect(countTags(patterns.map((p) => editTags(p.tags, edits)))).toEqual([
      { tag: "BASIC", count: 2 },
      { tag: "Dip", count: 1 },
      { tag: "Spin", count: 2 },
    ]);
  });

  it("hands back the same array, and the same figures, where nothing changes", () => {
    expect(applyTagEdits(patterns, NO_TAG_EDITS)).toBe(patterns);
    const unrelated = addTagEdit(NO_TAG_EDITS, "Nowhere", "Else");
    expect(applyTagEdits(patterns, unrelated)).toBe(patterns);
    const result = applyTagEdits(
      patterns,
      addTagEdit(NO_TAG_EDITS, "Dip", "Drop"),
    );
    expect(result).not.toBe(patterns);
    expect(result[0]).toBe(patterns[0]);
    expect(result[2]).toEqual({ ...patterns[2], tags: ["Drop"] });
  });
});
