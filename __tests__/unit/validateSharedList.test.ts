import { validateSharedList } from "@/src/pattern/data/validation/validateSharedList";
import { extractYouTubeVideoId } from "@/src/common/utils/YouTubeUtils";
import {
  createTestPattern,
  createTestPatternList,
  createTestPatternType,
} from "@/utils/testFactories";

const TYPE = createTestPatternType({ slug: "push" });
const CODE = "ABCD1234";

const publishedList = (overrides: Record<string, unknown> = {}) => ({
  ...createTestPatternList({ patternTypes: [TYPE] }),
  shareCode: CODE,
  ...overrides,
});

describe("validateSharedList", () => {
  it("keeps a well-formed list as it was published", () => {
    const list = publishedList();
    const patterns = [
      createTestPattern(TYPE.id, {
        id: 1,
        videoRefs: [{ type: "url", value: "https://youtu.be/abc123" }],
      }),
    ];

    const result = validateSharedList(list, patterns, CODE);

    expect(result?.id).toBe(list.id);
    expect(result?.name).toBe(list.name);
    expect(result?.shareCode).toBe(CODE);
    expect(result?.patterns.map((p) => p.name)).toEqual([patterns[0].name]);
    expect(result?.patterns[0].videoRefs).toEqual(patterns[0].videoRefs);
  });

  it.each([
    ["not an object", "a list"],
    ["null", null],
    ["no id", { name: "Mine" }],
  ])("refuses a list that is %s", (_, raw) => {
    expect(validateSharedList(raw, [], CODE)).toBeNull();
  });

  it("refuses a list whose figures cannot be read", () => {
    expect(
      validateSharedList(publishedList(), [{ id: "one", name: 3 }], CODE),
    ).toBeNull();
    expect(validateSharedList(publishedList(), "patterns", CODE)).toBeNull();
  });

  it("keeps only web videos, everywhere a video can be", () => {
    const bad = [
      { type: "local", value: "file:///data/user/0/app/files/secret.mp4" },
      { type: "url", value: "file:///sdcard/DCIM/private.mp4" },
      { type: "url", value: "content://media/external/video/1" },
      { type: "url", value: "javascript:alert(1)" },
    ];
    const good = { type: "url", value: "https://vimeo.com/123" };
    const list = publishedList({
      modifiers: [
        {
          id: "m1",
          name: "with hesitation",
          universal: true,
          position: "postfix",
          videoRefs: [...bad, good],
        },
        {
          id: "m2",
          name: "with inside turn",
          universal: false,
          position: "postfix",
          videoRefs: [],
        },
      ],
    });
    const patterns = [
      createTestPattern(TYPE.id, {
        id: 1,
        videoRefs: [...bad, good] as never,
        modifierRefs: [
          { modifierId: "m2", videoRefs: [...bad, good] as never },
        ],
      }),
    ];

    const result = validateSharedList(list, patterns, CODE)!;

    expect(result.patterns[0].videoRefs).toEqual([good]);
    expect(result.patterns[0].modifierRefs?.[0]?.videoRefs).toEqual([good]);
    expect(result.modifiers[0].videoRefs).toEqual([good]);
  });

  it("takes nothing that is this phone's own business from the cloud", () => {
    const result = validateSharedList(
      publishedList({
        readonly: true,
        shareKey: "k".repeat(40),
        shareCode: "ZZZZ9999",
      }),
      [],
      CODE,
    )!;

    expect(result.readonly).toBeUndefined();
    expect(result.shareKey).toBeUndefined();
    // The code it was read under, not the one the document claims.
    expect(result.shareCode).toBe(CODE);
  });
});

describe("extractYouTubeVideoId", () => {
  it("reads an ordinary id", () => {
    expect(extractYouTubeVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe(
      "dQw4w9WgXcQ",
    );
    expect(
      extractYouTubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
    ).toBe("dQw4w9WgXcQ");
  });

  it.each([
    "https://www.youtube.com/watch?v=x'%3Balert(1)%2F%2F",
    "https://www.youtube.com/watch?v=a%20b",
    "https://youtu.be/%3Cscript%3E",
  ])("refuses an id with characters YouTube never uses: %s", (url) => {
    expect(extractYouTubeVideoId(url)).toBeNull();
  });
});
