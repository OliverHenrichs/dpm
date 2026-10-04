import {
  buildListEntries,
  isSectionedSort,
  PatternListEntry,
  sortPatterns,
} from "@/src/pattern/list/hooks/patternSections";
import { IPattern } from "@/src/pattern/types/IPatternList";
import {
  createTestPattern,
  createTestPatternType,
} from "@/utils/testFactories";

const whip = createTestPatternType({ slug: "whip" });
const push = createTestPatternType({ slug: "push" });
// The list's own order: whips first, though "push" sorts before "whip" by spelling and the
// ids are random.
const types = [whip, push];

let nextId = 1;
function pattern(name: string, overrides: Partial<IPattern> = {}): IPattern {
  return createTestPattern(push.id, { id: nextId++, name, ...overrides });
}

const names = (patterns: IPattern[]) => patterns.map((p) => p.name);

const labels = {
  level: (level: string) => `L:${level}`,
  counts: (n: number) => `${n} counts`,
  noLevel: "No level",
  noType: "No type",
};

function headers(entries: PatternListEntry[]) {
  return entries
    .filter((e) => e.kind === "section")
    .map((e) => `${e.title} (${e.count})`);
}

describe("sortPatterns", () => {
  it("orders types as the list does, not by id or spelling", () => {
    const sorted = sortPatterns(
      [pattern("Sugar Push"), pattern("Basic Whip", { typeId: whip.id })],
      { field: "typeId", order: "asc" },
      types,
    );
    expect(names(sorted)).toEqual(["Basic Whip", "Sugar Push"]);
  });

  it("runs levels from beginner to advanced, not alphabetically", () => {
    const sorted = sortPatterns(
      [
        pattern("C", { level: "advanced" }),
        pattern("A", { level: "intermediate" }),
        pattern("B", { level: "beginner" }),
      ],
      { field: "level", order: "asc" },
    );
    expect(names(sorted)).toEqual(["B", "A", "C"]);
  });

  it("keeps patterns without a level last, also when descending", () => {
    const list = [
      pattern("None", { level: undefined }),
      pattern("Beg", { level: "beginner" }),
      pattern("Adv", { level: "advanced" }),
    ];
    expect(names(sortPatterns(list, { field: "level", order: "asc" }))).toEqual(
      ["Beg", "Adv", "None"],
    );
    expect(
      names(sortPatterns(list, { field: "level", order: "desc" })),
    ).toEqual(["Adv", "Beg", "None"]);
  });

  it("puts a type the list no longer has last", () => {
    const sorted = sortPatterns(
      [pattern("Orphan", { typeId: "gone" }), pattern("Sugar Push")],
      { field: "typeId", order: "asc" },
      types,
    );
    expect(names(sorted)).toEqual(["Sugar Push", "Orphan"]);
  });

  it("reads alphabetically inside a section whichever way the sections run", () => {
    const list = [
      pattern("Tuck Turn", { counts: 6 }),
      pattern("Basic Whip", { counts: 8 }),
      pattern("Sugar Push", { counts: 6 }),
    ];
    expect(
      names(sortPatterns(list, { field: "counts", order: "desc" })),
    ).toEqual(["Basic Whip", "Sugar Push", "Tuck Turn"]);
  });

  it("does not reorder the caller's array", () => {
    const list = [pattern("B"), pattern("A")];
    sortPatterns(list, { field: "name", order: "asc" });
    expect(names(list)).toEqual(["B", "A"]);
  });
});

describe("buildListEntries", () => {
  it("adds no headers for a sort by name or date added", () => {
    const list = [pattern("A"), pattern("B")];
    expect(isSectionedSort("name")).toBe(false);
    expect(isSectionedSort("id")).toBe(false);
    expect(headers(buildListEntries(list, "name", types, labels))).toEqual([]);
    expect(headers(buildListEntries(list, "id", types, labels))).toEqual([]);
  });

  it("heads each type with its name, colour and count", () => {
    const sorted = sortPatterns(
      [
        pattern("Sugar Push"),
        pattern("Basic Whip", { typeId: whip.id }),
        pattern("Hustle Whip", { typeId: whip.id }),
      ],
      { field: "typeId", order: "asc" },
      types,
    );
    const entries = buildListEntries(sorted, "typeId", types, labels);
    expect(headers(entries)).toEqual(["whip (2)", "push (1)"]);
    expect(entries[0]).toMatchObject({ kind: "section", color: whip.color });
    expect(entries.map((e) => e.kind)).toEqual([
      "section",
      "pattern",
      "pattern",
      "section",
      "pattern",
    ]);
  });

  it("gathers patterns without a level under one last header", () => {
    const sorted = sortPatterns(
      [
        pattern("A", { level: undefined }),
        pattern("B", { level: "beginner" }),
        pattern("C", { level: undefined }),
      ],
      { field: "level", order: "asc" },
    );
    expect(headers(buildListEntries(sorted, "level", types, labels))).toEqual([
      "L:beginner (1)",
      "No level (2)",
    ]);
  });

  it("heads each count", () => {
    const sorted = sortPatterns(
      [pattern("A", { counts: 8 }), pattern("B", { counts: 6 })],
      { field: "counts", order: "asc" },
    );
    expect(headers(buildListEntries(sorted, "counts", types, labels))).toEqual([
      "6 counts (1)",
      "8 counts (1)",
    ]);
  });

  it("keys pattern rows by id, so a row keeps its state across a re-sort", () => {
    const p = pattern("A");
    const [entry] = buildListEntries([p], "name", types, labels);
    expect(entry).toEqual({ kind: "pattern", key: String(p.id), pattern: p });
  });
});
