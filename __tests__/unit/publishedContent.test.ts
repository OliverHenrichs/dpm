import {
  publishedModifiers,
  publishedPattern,
} from "@/src/firebase/publishedContent";
import { IVideoReference } from "@/src/pattern/types/IPatternList";
import { createTestPattern } from "@/utils/testFactories";

const transcript = {
  language: "en",
  model: "whisper-base-q5_1",
  createdAt: 0,
  segments: [],
};
const local: IVideoReference = {
  type: "local",
  value: "file:///data/user/0/app/files/imported-1.mp4",
  transcript,
};
const online: IVideoReference = {
  type: "url",
  value: "https://youtu.be/abc",
  startTime: 12,
};

describe("publishedPattern", () => {
  it("keeps URL videos and drops local ones, also on modifier attachments", () => {
    const pattern = createTestPattern("t", {
      videoRefs: [local, online],
      modifierRefs: [{ modifierId: "m", videoRefs: [online, local] }],
    });

    const published = publishedPattern(pattern);

    expect(published.videoRefs).toEqual([online]);
    expect(published.modifierRefs).toEqual([
      { modifierId: "m", videoRefs: [online] },
    ]);
    expect(pattern.videoRefs).toEqual([local, online]);
  });

  it("drops transcripts from URL videos", () => {
    const pattern = createTestPattern("t", {
      videoRefs: [{ ...online, transcript }],
    });

    expect(publishedPattern(pattern).videoRefs).toEqual([online]);
  });
});

describe("publishedModifiers", () => {
  it("keeps only a universal modifier's URL videos, without transcripts", () => {
    const published = publishedModifiers([
      {
        id: "m",
        name: "hesitation",
        position: "prefix",
        universal: true,
        videoRefs: [local, { ...online, transcript }],
      },
    ]);

    expect(published[0].videoRefs).toEqual([online]);
  });
});
