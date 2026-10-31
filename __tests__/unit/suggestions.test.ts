import {
  canSuggestTo,
  counterIdFor,
  patternFromSuggestion,
  receivesSuggestions,
  suggestedPattern,
  utcDay,
} from "@/src/pattern/suggestions/suggestions";
import { NewPattern } from "@/src/pattern/types/IPatternList";
import {
  createTestPattern,
  createTestPatternList,
} from "@/utils/testFactories";

const DAY = 86_400_000;

describe("counting days", () => {
  it("counts whole UTC days since the epoch", () => {
    expect(utcDay(0)).toBe(0);
    expect(utcDay(DAY - 1)).toBe(0);
    expect(utcDay(DAY)).toBe(1);
  });

  it("names the list's counter or the subscriber's own", () => {
    const now = 20_000 * DAY + 5;
    expect(counterIdFor({ dailyLimit: 3, per: "list" }, "uid", now)).toBe(
      "d20000",
    );
    expect(counterIdFor({ dailyLimit: 3, per: "subscriber" }, "uid", now)).toBe(
      "d20000_uid",
    );
  });
});

describe("which lists suggest and receive", () => {
  const policy = { dailyLimit: 3, per: "list" } as const;

  it("lets a subscribed copy suggest only when the list takes suggestions", () => {
    expect(
      canSuggestTo(
        createTestPatternList({
          readonly: true,
          shareCode: "AB12CD34",
          suggestions: policy,
        }),
      ),
    ).toBe(true);
    expect(
      canSuggestTo(
        createTestPatternList({ readonly: true, shareCode: "AB12CD34" }),
      ),
    ).toBe(false);
    // The publisher's own list, and a read-only import with no code.
    expect(
      canSuggestTo(
        createTestPatternList({ shareCode: "AB12CD34", suggestions: policy }),
      ),
    ).toBe(false);
    expect(
      canSuggestTo(
        createTestPatternList({ readonly: true, suggestions: policy }),
      ),
    ).toBe(false);
    expect(canSuggestTo(null)).toBe(false);
  });

  it("receives suggestions on the publisher's own published list", () => {
    expect(
      receivesSuggestions(createTestPatternList({ shareCode: "AB12CD34" })),
    ).toBe(true);
    expect(
      receivesSuggestions(
        createTestPatternList({ shareCode: "AB12CD34", readonly: true }),
      ),
    ).toBe(false);
    expect(receivesSuggestions(createTestPatternList())).toBe(false);
  });
});

describe("suggestedPattern", () => {
  const base: NewPattern = {
    name: "  Sugar Tuck  ",
    typeId: "t",
    counts: 6,
    prerequisites: [1],
    description: "",
    tags: ["Course 1"],
    videoRefs: [
      { type: "url", value: "https://youtu.be/a", startTime: 12 },
      {
        type: "local",
        value: "file:///video.mp4",
        transcript: { language: "en", model: "m", createdAt: 1, segments: [] },
      },
    ],
    modifierRefs: [
      {
        modifierId: "m1",
        videoRefs: [{ type: "local", value: "file:///b.mp4" }],
      },
    ],
    createdAt: 1_760_000_000_000,
  };

  it("leaves out a rhythm longer than the rules take", () => {
    const counts = 100;
    const rhythm = Array.from({ length: counts }, (_, i) => i + 1).join(" ");

    expect(rhythm.length).toBeGreaterThan(200);
    expect(suggestedPattern({ ...base, counts, rhythm })).not.toHaveProperty(
      "rhythm",
    );
    expect(suggestedPattern({ ...base, rhythm: "1 2 3&4 5&6" }).rhythm).toBe(
      "1 2 3&4 5&6",
    );
  });

  it("sends what the form holds, without what stays on the phone", () => {
    const sent = suggestedPattern(base);
    expect(sent).toEqual({
      name: "Sugar Tuck",
      typeId: "t",
      counts: 6,
      prerequisites: [1],
      description: "",
      tags: ["Course 1"],
      videoRefs: [{ type: "url", value: "https://youtu.be/a", startTime: 12 }],
      modifierRefs: [{ modifierId: "m1", videoRefs: [] }],
    });
  });

  it("leaves out an id and empty optional fields, which Firestore would refuse as undefined", () => {
    const sent = suggestedPattern({
      ...base,
      id: 7,
      level: undefined,
      rhythm: undefined,
    } as NewPattern);
    expect(sent).not.toHaveProperty("id");
    expect(sent).not.toHaveProperty("level");
    expect(sent).not.toHaveProperty("rhythm");
    expect(sent).not.toHaveProperty("createdAt");
  });

  it("keeps a level and a rhythm", () => {
    const sent = suggestedPattern({
      ...base,
      level: "beginner",
      rhythm: "1 2 3&4 5&6",
    });
    expect(sent.level).toBe("beginner");
    expect(sent.rhythm).toBe("1 2 3&4 5&6");
  });

  it("stays within the bounds the rules hold it to", () => {
    const sent = suggestedPattern({
      ...base,
      name: "x".repeat(150),
      description: "y".repeat(3000),
      tags: Array.from({ length: 30 }, (_, i) => `t${i}`),
    });
    expect(sent.name).toHaveLength(100);
    expect(sent.description).toHaveLength(2000);
    expect(sent.tags).toHaveLength(20);
  });
});

describe("patternFromSuggestion", () => {
  const list = createTestPatternList({
    modifiers: [
      {
        id: "turn",
        name: "with Inside Turn",
        position: "postfix",
        universal: false,
        videoRefs: [],
      },
      {
        id: "hesitation",
        name: "Hesitation",
        position: "amends",
        universal: true,
        videoRefs: [],
      },
    ],
  });
  const [push, pass] = list.patternTypes;
  const patterns = [
    createTestPattern(push.id, { id: 1, name: "Sugar Push" }),
    createTestPattern(pass.id, { id: 2, name: "Left Side Pass" }),
  ];

  it("keeps a well-formed suggestion as it is", () => {
    const raw = {
      name: "Sugar Tuck",
      typeId: push.id,
      counts: 6,
      level: "beginner",
      rhythm: "1 2 3&4 5&6",
      prerequisites: [1],
      description: "A sugar push with a tuck turn.",
      tags: ["Course 2"],
      videoRefs: [{ type: "url", value: "https://youtu.be/a" }],
      modifierRefs: [{ modifierId: "turn", videoRefs: [] }],
    };
    expect(patternFromSuggestion(raw, list, patterns)).toEqual(raw);
  });

  it("keeps a rolling count that fits the counts", () => {
    const raw = {
      name: "Telemark",
      typeId: push.id,
      counts: 6,
      rhythm: "1 2 3&4&5 6",
      prerequisites: [],
      description: "",
      tags: [],
      videoRefs: [],
      modifierRefs: [],
    };
    expect(patternFromSuggestion(raw, list, patterns)?.rhythm).toBe(
      "1 2 3&4&5 6",
    );
  });

  it("drops what the list does not have, or no longer has", () => {
    const result = patternFromSuggestion(
      {
        name: "Sugar Tuck",
        typeId: "gone",
        counts: 6,
        prerequisites: [1, 1, 99, "2"],
        description: "",
        tags: [" Course 2 ", "", 3, "Course 2"],
        videoRefs: [
          { type: "local", value: "file:///x.mp4" },
          { type: "url", value: "javascript:alert(1)" },
          { type: "url", value: "https://youtu.be/a", startTime: -1 },
        ],
        modifierRefs: [
          { modifierId: "hesitation", videoRefs: [] },
          { modifierId: "turn", videoRefs: "nope" },
          { modifierId: "turn", videoRefs: [] },
          { modifierId: "missing", videoRefs: [] },
        ],
        level: "expert",
        rhythm: "1 2 3",
      },
      list,
      patterns,
    );
    expect(result).toEqual({
      name: "Sugar Tuck",
      typeId: push.id,
      counts: 6,
      prerequisites: [1],
      description: "",
      tags: ["Course 2"],
      videoRefs: [{ type: "url", value: "https://youtu.be/a" }],
      modifierRefs: [{ modifierId: "turn", videoRefs: [] }],
    });
  });

  it("refuses something that is not a pattern, or has no name", () => {
    expect(patternFromSuggestion(null, list, patterns)).toBeNull();
    expect(patternFromSuggestion([], list, patterns)).toBeNull();
    expect(patternFromSuggestion({ name: "  " }, list, patterns)).toBeNull();
  });

  it("fills what is missing", () => {
    expect(patternFromSuggestion({ name: "Whip" }, list, patterns)).toEqual({
      name: "Whip",
      typeId: push.id,
      counts: 0,
      prerequisites: [],
      description: "",
      tags: [],
      videoRefs: [],
      modifierRefs: [],
    });
  });
});
