import { vocabularyPrompt } from "@/src/transcribe/vocabulary";
import { generateUUID } from "@/src/pattern/types/PatternType";
import {
  createTestPattern,
  createTestPatternList,
  createTestPatternType,
} from "@/utils/testFactories";

const push = createTestPatternType({ slug: "push" });
const whip = createTestPatternType({ slug: "whip" });

function list(
  extra: Partial<Parameters<typeof createTestPatternList>[0]> = {},
) {
  return createTestPatternList({ patternTypes: [push, whip], ...extra });
}

describe("vocabularyPrompt", () => {
  it("names the list's patterns, types, modifiers and tags, in that order", () => {
    const patterns = [
      createTestPattern(push.id, {
        id: 1,
        name: "Sugar Push",
        tags: ["basics"],
      }),
      createTestPattern(whip.id, { id: 2, name: "Whip", tags: [] }),
    ];
    const modifiers = [
      {
        id: generateUUID(),
        name: "with a spin",
        position: "postfix" as const,
        universal: false,
        videoRefs: [],
      },
    ];

    expect(vocabularyPrompt(list({ modifiers }), patterns)).toBe(
      "Sugar Push, Whip, push, with a spin, basics.",
    );
  });

  it("says each word once, whatever its case", () => {
    const patterns = [
      createTestPattern(whip.id, {
        id: 1,
        name: "Whip",
        tags: ["whip", "WHIP"],
      }),
    ];

    expect(vocabularyPrompt(list(), patterns)).toBe("Whip, push.");
  });

  it("stays short enough for the decoder, dropping whole words", () => {
    const patterns = Array.from({ length: 200 }, (_, i) =>
      createTestPattern(push.id, { id: i + 1, name: `Pattern number ${i}` }),
    );

    const prompt = vocabularyPrompt(list(), patterns);

    expect(prompt.length).toBeLessThanOrEqual(225);
    expect(prompt).toMatch(/Pattern number \d+\.$/);
  });

  it("is empty for an empty list", () => {
    expect(
      vocabularyPrompt(createTestPatternList({ patternTypes: [] }), []),
    ).toBe("");
  });
});
