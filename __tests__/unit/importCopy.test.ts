import {
  importedListCopy,
  nextFreeListName,
  sameListName,
} from "@/src/pattern/data/importCopy";
import {
  createTestPattern,
  createTestPatternList,
} from "@/utils/testFactories";

describe("nextFreeListName", () => {
  it("numbers from 2, skipping names already taken", () => {
    expect(nextFreeListName("Salsa", ["Salsa"])).toBe("Salsa (2)");
    expect(nextFreeListName("Salsa", ["Salsa", "salsa (2)"])).toBe("Salsa (3)");
  });

  it("counts on from a name that already carries a number", () => {
    expect(nextFreeListName("Salsa (2)", ["Salsa", "Salsa (2)"])).toBe(
      "Salsa (3)",
    );
  });

  it("keeps a name that is only a number in brackets", () => {
    expect(nextFreeListName("(2)", ["(2)"])).toBe("(2) (2)");
  });
});

describe("sameListName", () => {
  it("ignores case and surrounding space", () => {
    expect(sameListName(" Salsa", "salsa ")).toBe(true);
    expect(sameListName("Salsa", "Salsa 2")).toBe(false);
  });
});

describe("importedListCopy", () => {
  it("is a new, unpublished list with the same figures", () => {
    const list = {
      ...createTestPatternList({
        name: "Salsa",
        shareCode: "ABCD1234",
        shareKey: "secret",
        nextPatternId: 5,
      }),
      patterns: [createTestPattern("t", { id: 4 })],
    };

    const copy = importedListCopy(list, "Salsa (2)", 42);

    expect(copy.id).not.toBe(list.id);
    expect(copy.name).toBe("Salsa (2)");
    expect(copy.updatedAt).toBe(42);
    expect(copy).not.toHaveProperty("shareCode");
    expect(copy).not.toHaveProperty("shareKey");
    // Ids inside the list are scoped to it, so they come along as they are.
    expect(copy.patterns).toBe(list.patterns);
    expect(copy.patternTypes).toBe(list.patternTypes);
    expect(copy.nextPatternId).toBe(5);
  });
});
