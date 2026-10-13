import { createExampleList } from "@/src/pattern/data/ExampleList";
import {
  createPatternType,
  createTemplateModifiers,
  resolveTemplatePatterns,
  TEMPLATE_FOUNDATIONAL_PATTERNS,
  TEMPLATE_MODIFIERS,
} from "@/src/pattern/data/DefaultPatternLists";

const t = (key: string) => key;

describe("the example list", () => {
  const example = createExampleList(t);
  const byName = (name: string) =>
    example.patterns.find((p) => p.name === name)!;

  it("has unique ids from 1 and only prerequisites that exist", () => {
    const ids = example.patterns.map((p) => p.id);
    expect(ids).toEqual(ids.map((_, i) => i + 1));
    for (const pattern of example.patterns) {
      for (const id of pattern.prerequisites) {
        expect(ids).toContain(id);
        expect(id).not.toBe(pattern.id);
      }
    }
  });

  it("connects figures to what they build on", () => {
    expect(byName("Sugar Tuck").prerequisites).toEqual([
      byName("Sugar Push").id,
    ]);
    expect(byName("Tuck Turn").prerequisites).toEqual([
      byName("Left Side Pass").id,
    ]);
    expect(byName("Basket Whip").prerequisites).toEqual([
      byName("Basic Whip").id,
    ]);
  });

  it("attaches only the list's non-universal modifiers", () => {
    const attachable = new Set(
      example.modifiers.filter((m) => !m.universal).map((m) => m.id),
    );
    const refs = example.patterns.flatMap((p) => p.modifierRefs);
    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) expect(attachable.has(ref.modifierId)).toBe(true);
    expect(example.modifiers.some((m) => m.universal)).toBe(true);
  });

  it("gives every pattern a type of the list, a tag and the WCS rhythm", () => {
    const typeIds = new Set(example.patternTypes.map((type) => type.id));
    for (const pattern of example.patterns) {
      expect(typeIds.has(pattern.typeId)).toBe(true);
      expect(pattern.tags).toHaveLength(1);
      expect(pattern.rhythm).toBeDefined();
    }
    expect(example.dance).toBe("wcs");
  });

  it("translates its name, tags and descriptions", () => {
    expect(example.name).toBe("exampleListName");
    expect(byName("Sugar Push").description).toBe("exampleDescSugarPush");
    expect(byName("Sugar Push").tags).toEqual(["exampleTagBeginners1"]);
  });
});

describe("resolving template patterns", () => {
  const types = ["push", "pass", "whip", "tuck"].map((slug) =>
    createPatternType(slug, "#000000"),
  );

  it("links the WCS template's figures and modifiers", () => {
    const modifiers = createTemplateModifiers(TEMPLATE_MODIFIERS.wcs);
    const patterns = resolveTemplatePatterns(
      TEMPLATE_FOUNDATIONAL_PATTERNS.wcs,
      types,
      "wcs",
      modifiers,
    );
    const tuckTurn = patterns.find((p) => p.name === "Tuck Turn")!;
    const pass = patterns.find((p) => p.name === "Left Side Pass")!;
    expect(tuckTurn.prerequisites).toEqual([pass.id]);
    expect(pass.modifierRefs).toHaveLength(3);
  });

  it("drops a prerequisite that was left out", () => {
    const [tuck] = resolveTemplatePatterns(
      [
        {
          name: "Sugar Tuck",
          typeSlug: "tuck",
          counts: 6,
          description: "",
          prerequisites: ["Sugar Push"],
          modifiers: ["with Free Spin"],
        },
      ],
      types,
    );
    expect(tuck.id).toBe(1);
    expect(tuck.prerequisites).toEqual([]);
    expect(tuck.modifierRefs).toEqual([]);
  });
});
