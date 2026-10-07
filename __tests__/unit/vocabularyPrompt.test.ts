import {
  estimateTokens,
  patternWithVideo,
  promptFromTerms,
  usualTranscriptLanguage,
  vocabularyPrompt,
} from "@/src/transcribe/vocabulary";
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
  it("names the list's patterns, types, modifiers and tags, most important last", () => {
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
      "basics, with a spin, push, Whip, Sugar Push.",
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

    expect(vocabularyPrompt(list(), patterns)).toBe("push, Whip.");
  });

  it("stays short enough for the decoder, dropping whole words", () => {
    const patterns = Array.from({ length: 200 }, (_, i) =>
      createTestPattern(push.id, { id: i + 1, name: `Pattern number ${i}` }),
    );

    const prompt = vocabularyPrompt(list(), patterns);

    // Within whisper.cpp's 223 prompt tokens, at about four characters a token.
    expect(prompt.length).toBeLessThanOrEqual(600);
    expect(prompt).toMatch(/^Pattern number \d+, .*Pattern number 0\.$/);
  });

  it("is empty for an empty list", () => {
    expect(
      vocabularyPrompt(createTestPatternList({ patternTypes: [] }), []),
    ).toBe("");
  });

  it("puts the video's pattern, its modifiers and prerequisites where they count most", () => {
    const duck = {
      id: generateUUID(),
      name: "with duck",
      position: "postfix" as const,
      universal: false,
      videoRefs: [],
    };
    const others = Array.from({ length: 40 }, (_, i) =>
      createTestPattern(push.id, { id: i + 1, name: `Pattern number ${i}` }),
    );
    const basic = createTestPattern(whip.id, { id: 50, name: "Basic Whip" });
    const inside = createTestPattern(whip.id, {
      id: 51,
      name: "Inside Turn Whip",
      prerequisites: [50],
      modifierRefs: [{ modifierId: duck.id, videoRefs: [] }],
    });

    const prompt = vocabularyPrompt(
      list({ modifiers: [duck] }),
      [...others, basic, inside],
      { name: "Inside Turn Whip", pattern: inside },
    );

    expect(prompt).toMatch(
      /, Pattern number 0, Basic Whip, with duck, Inside Turn Whip\.$/,
    );
  });

  it("names a new pattern by its name in the form", () => {
    expect(vocabularyPrompt(list(), [], { name: "Starter Step" })).toBe(
      "whip, push, Starter Step.",
    );
  });

  it("adds the dance's standard terms after the list's own pattern names", () => {
    const patterns = [
      createTestPattern(push.id, { id: 1, name: "Sugar Push" }),
    ];

    const prompt = vocabularyPrompt(list({ dance: "wcs" }), patterns);

    expect(prompt).toMatch(/, left side pass, anchor step, Sugar Push\.$/);
    // Said once, though the glossary has it too.
    expect(prompt.match(/sugar push/gi)).toHaveLength(1);
  });
});

describe("promptFromTerms", () => {
  it("keeps the first of each term, writes the most important last, ends with a full stop", () => {
    expect(promptFromTerms(["sugar push", "Sugar Push", " whip "])).toBe(
      "whip, sugar push.",
    );
  });

  it("leaves room for terms in other scripts by their cost, not their length", () => {
    const hindi = Array.from({ length: 60 }, (_, i) => `शब्द${i}`);

    const prompt = promptFromTerms(hindi);

    expect(estimateTokens(prompt)).toBeLessThanOrEqual(200);
    expect(prompt).toMatch(/शब्द0\.$/);
  });
});

describe("estimateTokens", () => {
  it("counts English generously and other scripts per character", () => {
    expect(estimateTokens("sugar push")).toBe(4);
    expect(estimateTokens("ocho")).toBe(2);
    expect(estimateTokens("शब्द")).toBe(8);
  });
});

describe("glossary spellings", () => {
  it("spells the dance's terms in the language given, where the glossary has one", () => {
    const prompt = vocabularyPrompt(list({ dance: "wcs" }), [], {
      language: "de",
    });
    expect(prompt).toMatch(/anchor step\.$/);
  });
});

describe("usualTranscriptLanguage", () => {
  const withTranscript = (id: number, language: string) =>
    createTestPattern(push.id, {
      id,
      videoRefs: [
        {
          type: "local",
          value: `file:///${id}.mp4`,
          transcript: { language, model: "m", createdAt: 1, segments: [] },
        },
      ],
    });

  it("is the language most of the list's transcripts are in", () => {
    expect(
      usualTranscriptLanguage([
        withTranscript(1, "de"),
        withTranscript(2, "en"),
        withTranscript(3, "de"),
        withTranscript(4, "und"),
      ]),
    ).toBe("de");
  });

  it("is unknown without transcripts", () => {
    expect(usualTranscriptLanguage([withTranscript(1, "und")])).toBeUndefined();
    expect(usualTranscriptLanguage([])).toBeUndefined();
  });
});

describe("patternWithVideo", () => {
  it("finds the pattern carrying a video, on itself or on a modifier", () => {
    const own = createTestPattern(push.id, {
      id: 1,
      videoRefs: [{ type: "local", value: "file:///a.mp4" }],
    });
    const onModifier = createTestPattern(push.id, {
      id: 2,
      modifierRefs: [
        {
          modifierId: "m",
          videoRefs: [{ type: "local", value: "file:///b.mp4" }],
        },
      ],
    });

    expect(patternWithVideo([own, onModifier], "file:///a.mp4")).toBe(own);
    expect(patternWithVideo([own, onModifier], "file:///b.mp4")).toBe(
      onModifier,
    );
    expect(
      patternWithVideo([own, onModifier], "file:///c.mp4"),
    ).toBeUndefined();
  });
});
