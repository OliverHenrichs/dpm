import { collectReels } from "@/src/reels/reels";
import {
  createTestPattern,
  createTestPatternList,
} from "@/utils/testFactories";

const video = (value: string) => ({ type: "local" as const, value });

describe("collectReels", () => {
  const list = createTestPatternList({
    name: "WCS Level 1",
    modifiers: [
      {
        id: "turn",
        name: "with inside turn",
        position: "postfix",
        universal: false,
        videoRefs: [],
      },
    ],
  });
  const push = list.patternTypes[0];

  it("keeps only patterns with a video, by name", () => {
    const reels = collectReels([
      {
        list,
        patterns: [
          createTestPattern(push.id, {
            id: 1,
            name: "Whip",
            videoRefs: [video("whip.mp4")],
          }),
          createTestPattern(push.id, { id: 2, name: "Left Side Pass" }),
          createTestPattern(push.id, {
            id: 3,
            name: "Sugar Push",
            videoRefs: [video("push.mp4")],
          }),
        ],
      },
    ]);

    expect(reels.map((r) => r.pattern.name)).toEqual(["Sugar Push", "Whip"]);
    expect(reels[0]).toMatchObject({
      listName: "WCS Level 1",
      typeName: push.slug,
      typeColor: push.color,
    });
  });

  it("follows a pattern's own videos with those danced with a modifier", () => {
    const [reel] = collectReels([
      {
        list,
        patterns: [
          createTestPattern(push.id, {
            id: 1,
            name: "Whip",
            videoRefs: [video("whip.mp4")],
            modifierRefs: [
              { modifierId: "turn", videoRefs: [video("whip-turn.mp4")] },
              { modifierId: "gone", videoRefs: [video("whip-old.mp4")] },
            ],
          }),
        ],
      },
    ]);

    expect(reel.videos.map((v) => [v.video.value, v.modifierName])).toEqual([
      ["whip.mp4", undefined],
      ["whip-turn.mp4", "with inside turn"],
      ["whip-old.mp4", undefined],
    ]);
  });

  it("counts a pattern whose only videos are with a modifier", () => {
    const reels = collectReels([
      {
        list,
        patterns: [
          createTestPattern(push.id, {
            modifierRefs: [
              { modifierId: "turn", videoRefs: [video("whip-turn.mp4")] },
            ],
          }),
        ],
      },
    ]);

    expect(reels).toHaveLength(1);
  });

  it("keeps the lists in the order given", () => {
    const other = createTestPatternList({ name: "Festival" });
    const reels = collectReels([
      {
        list: other,
        patterns: [
          createTestPattern(other.patternTypes[0].id, {
            name: "Whip",
            videoRefs: [video("a.mp4")],
          }),
        ],
      },
      {
        list,
        patterns: [
          createTestPattern(push.id, {
            name: "Sugar Push",
            videoRefs: [video("b.mp4")],
          }),
        ],
      },
    ]);

    expect(reels.map((r) => r.listName)).toEqual(["Festival", "WCS Level 1"]);
  });
});
