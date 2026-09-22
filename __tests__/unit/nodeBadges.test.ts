import { nodeBadges } from "@/src/pattern/graph/model/nodeBadges";
import {
  IPattern,
  IPatternModifierRef,
  IVideoReference,
} from "@/src/pattern/types/IPatternList";
import {
  createTestPattern,
  createTestPatternType,
} from "@/utils/testFactories";

const TYPE = createTestPatternType({ slug: "push" });

const video = (value = "https://example.test/clip"): IVideoReference => ({
  type: "url",
  value,
});

const modifierRef = (
  videoRefs: IVideoReference[] = [],
): IPatternModifierRef => ({
  modifierId: "mod-1",
  videoRefs,
});

const pattern = (overrides: Partial<IPattern> = {}) =>
  createTestPattern(TYPE.id, { id: 1, name: "Whip", ...overrides });

describe("nodeBadges", () => {
  describe("video", () => {
    it("is absent when the pattern has none anywhere", () => {
      expect(nodeBadges(pattern()).hasVideo).toBe(false);
    });

    it("is present for a video on the pattern itself", () => {
      expect(nodeBadges(pattern({ videoRefs: [video()] })).hasVideo).toBe(true);
    });

    it("is present for a video on a modifier combination", () => {
      // "Whip with a tuck turn, filmed" is still something to watch here.
      const subject = pattern({ modifierRefs: [modifierRef([video()])] });

      expect(nodeBadges(subject).hasVideo).toBe(true);
    });

    it("is absent for a modifier attached without video", () => {
      const subject = pattern({ modifierRefs: [modifierRef()] });

      expect(nodeBadges(subject).hasVideo).toBe(false);
    });

    it("survives a modifier attachment with no video array", () => {
      // Attachments written before per-combination videos existed have no
      // `videoRefs` at all.
      const subject = pattern({
        modifierRefs: [{ modifierId: "a" } as IPatternModifierRef],
      });

      expect(nodeBadges(subject).hasVideo).toBe(false);
    });

    it("survives the fields being missing entirely", () => {
      // Lists written by older builds predate both arrays.
      const subject = {
        ...pattern(),
        videoRefs: undefined,
        modifierRefs: undefined,
      } as unknown as IPattern;

      expect(nodeBadges(subject).hasVideo).toBe(false);
    });
  });

  describe("modifiers", () => {
    it("counts none when there are none", () => {
      expect(nodeBadges(pattern()).modifierCount).toBe(0);
    });

    it("counts the modifiers attached to the pattern", () => {
      const subject = pattern({
        modifierRefs: [
          { modifierId: "a", videoRefs: [] },
          { modifierId: "b", videoRefs: [] },
        ],
      });

      expect(nodeBadges(subject).modifierCount).toBe(2);
    });

    it("counts a modifier whether or not it has video", () => {
      const subject = pattern({
        modifierRefs: [modifierRef([video()]), modifierRef()],
      });

      expect(nodeBadges(subject).modifierCount).toBe(2);
    });

    /**
     * A universal modifier applies to every pattern in the list, so it is
     * never in `modifierRefs` — badging it would put the same mark on every
     * node and say nothing. This is the behaviour that relies on that.
     */
    it("ignores universal modifiers, which are not attachments", () => {
      expect(nodeBadges(pattern()).modifierCount).toBe(0);
    });
  });
});
