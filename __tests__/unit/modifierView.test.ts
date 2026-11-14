import {
  buildModifierEntries,
  countModifierFilters,
  EMPTY_MODIFIER_FILTER,
  filterModifiers,
  sortModifiers,
} from "@/src/pattern/list/modifierView";
import { IModifier } from "@/src/pattern/types/IPatternList";

function modifier(
  name: string,
  position: IModifier["position"],
  universal = false,
): IModifier {
  return { id: name, name, position, universal, videoRefs: [] };
}

// The list's own order, which "date added" keeps.
const hesitation = modifier("Hesitation", "amends", true);
const duck = modifier("with Duck", "postfix");
const inside = modifier("with Inside Turn", "prefix");
const handChange = modifier("with Hand Change", "amends");
const modifiers = [hesitation, duck, inside, handChange];

const names = (list: IModifier[]) => list.map((m) => m.name);

describe("sortModifiers", () => {
  it("keeps the list's order for date added, and reverses it descending", () => {
    expect(
      names(sortModifiers(modifiers, { field: "added", order: "asc" })),
    ).toEqual([
      "Hesitation",
      "with Duck",
      "with Inside Turn",
      "with Hand Change",
    ]);
    expect(
      names(sortModifiers(modifiers, { field: "added", order: "desc" })),
    ).toEqual([
      "with Hand Change",
      "with Inside Turn",
      "with Duck",
      "Hesitation",
    ]);
  });

  it("sorts by name either way", () => {
    expect(
      names(sortModifiers(modifiers, { field: "name", order: "desc" })),
    ).toEqual([
      "with Inside Turn",
      "with Hand Change",
      "with Duck",
      "Hesitation",
    ]);
  });

  it("puts positions in dancing order, names ascending within each", () => {
    expect(
      names(sortModifiers(modifiers, { field: "position", order: "asc" })),
    ).toEqual([
      "with Inside Turn",
      "Hesitation",
      "with Hand Change",
      "with Duck",
    ]);
    expect(
      names(sortModifiers(modifiers, { field: "position", order: "desc" })),
    ).toEqual([
      "with Duck",
      "Hesitation",
      "with Hand Change",
      "with Inside Turn",
    ]);
  });

  it("leaves the given array alone", () => {
    sortModifiers(modifiers, { field: "added", order: "desc" });
    expect(modifiers[0]).toBe(hesitation);
  });
});

describe("filterModifiers", () => {
  it("lets everything through with an empty filter", () => {
    expect(filterModifiers(modifiers, EMPTY_MODIFIER_FILTER)).toEqual(
      modifiers,
    );
  });

  it("matches part of a name, ignoring case", () => {
    expect(
      names(
        filterModifiers(modifiers, { ...EMPTY_MODIFIER_FILTER, name: "TURN" }),
      ),
    ).toEqual(["with Inside Turn"]);
  });

  it("keeps the picked positions and kinds", () => {
    expect(
      names(
        filterModifiers(modifiers, {
          ...EMPTY_MODIFIER_FILTER,
          positions: ["amends"],
          kinds: ["attached"],
        }),
      ),
    ).toEqual(["with Hand Change"]);
  });

  it("counts each criterion that is set once", () => {
    expect(countModifierFilters(EMPTY_MODIFIER_FILTER)).toBe(0);
    expect(
      countModifierFilters({
        name: " ",
        positions: ["prefix", "postfix"],
        kinds: ["universal"],
      }),
    ).toBe(2);
  });
});

describe("buildModifierEntries", () => {
  it("heads each position with its count when sorted by position", () => {
    const sorted = sortModifiers(modifiers, {
      field: "position",
      order: "asc",
    });
    expect(
      buildModifierEntries(sorted, "position").map((e) =>
        e.kind === "section" ? `${e.position} ${e.count}` : e.modifier.name,
      ),
    ).toEqual([
      "prefix 1",
      "with Inside Turn",
      "amends 2",
      "Hesitation",
      "with Hand Change",
      "postfix 1",
      "with Duck",
    ]);
  });

  it("has no headers for the other sorts", () => {
    expect(
      buildModifierEntries(modifiers, "name").every(
        (e) => e.kind === "modifier",
      ),
    ).toBe(true);
  });
});
