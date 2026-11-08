import { createExampleList } from "@/src/pattern/data/ExampleList";
import { rhythmMatchesCounts } from "@/src/pattern/rhythm/rhythm";
import {
  createPatternType,
  createTemplateModifiers,
  createLatinList,
  createStandardList,
  createZoukList,
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
    expect(byName("Travelling Tuck").prerequisites).toEqual([
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

  it("leads the Zouk template from the basic through the viradinha into lateral", () => {
    const list = createZoukList();
    const patterns = resolveTemplatePatterns(
      TEMPLATE_FOUNDATIONAL_PATTERNS.zouk,
      list.patternTypes,
      "zouk",
    );
    const byName = (name: string) => patterns.find((p) => p.name === name)!;
    expect(patterns).toHaveLength(5);
    expect(byName("Viradinha").prerequisites).toEqual([byName("Basic").id]);
    expect(byName("Lateral").prerequisites).toEqual([byName("Viradinha").id]);
    expect(byName("Basic").rhythm).toBe("1 (2) 3 4 5 (6) 7 8");
  });

  it("gives every template figure a type of its list and a rhythm that fits its counts", () => {
    const lists = { standard: createStandardList(), latin: createLatinList() };
    for (const [id, list] of Object.entries(lists)) {
      const template = TEMPLATE_FOUNDATIONAL_PATTERNS[id];
      const patterns = resolveTemplatePatterns(
        template,
        list.patternTypes,
        id as "standard",
      );
      expect(patterns).toHaveLength(template.length);
      for (const pattern of patterns) {
        if (pattern.rhythm !== undefined) {
          expect(rhythmMatchesCounts(pattern.rhythm, pattern.counts)).toBe(
            true,
          );
        }
      }
    }
    for (const [id, template] of Object.entries(
      TEMPLATE_FOUNDATIONAL_PATTERNS,
    )) {
      for (const tp of template) {
        if (tp.rhythm !== undefined) {
          expect([
            id,
            tp.name,
            rhythmMatchesCounts(tp.rhythm, tp.counts),
          ]).toEqual([id, tp.name, true]);
        }
      }
    }
  });

  it("builds on a figure of the same dance in Standard and Latin", () => {
    const list = createStandardList();
    const patterns = resolveTemplatePatterns(
      TEMPLATE_FOUNDATIONAL_PATTERNS.standard,
      list.patternTypes,
      "standard",
    );
    const typeId = (slug: string) =>
      list.patternTypes.find((type) => type.slug === slug)!.id;
    const find = (name: string, slug: string) =>
      patterns.find((p) => p.name === name && p.typeId === typeId(slug))!;
    expect(find("Natural Spin Turn", "waltz").prerequisites).toEqual([
      find("Natural Turn", "waltz").id,
    ]);
    expect(
      find("Forward Change Step (Natural to Reverse)", "viennese-waltz")
        .prerequisites,
    ).toEqual([
      find("Natural Turn", "viennese-waltz").id,
      find("Reverse Turn", "viennese-waltz").id,
    ]);
    expect(find("Feather Step", "slow-foxtrot").rhythm).toBe("S Q Q");

    const latin = createLatinList();
    const latinPatterns = resolveTemplatePatterns(
      TEMPLATE_FOUNDATIONAL_PATTERNS.latin,
      latin.patternTypes,
      "latin",
    );
    const latinType = (slug: string) =>
      latin.patternTypes.find((type) => type.slug === slug)!.id;
    const rumbaFan = latinPatterns.find(
      (p) => p.name === "Fan" && p.typeId === latinType("rumba"),
    )!;
    const rumbaHockeyStick = latinPatterns.find(
      (p) => p.name === "Hockey Stick" && p.typeId === latinType("rumba"),
    )!;
    expect(rumbaHockeyStick.prerequisites).toEqual([rumbaFan.id]);
    // Cha Cha Cha and Rumba start on 2, which a rhythm cannot write.
    expect(rumbaFan.rhythm).toBeUndefined();
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
