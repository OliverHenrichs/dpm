import { act } from "react";
import { useReels } from "@/src/reels/hooks/useReels";
import { useActivePatternList } from "@/src/pattern/data/components/ActivePatternListContext";
import {
  createTestPattern,
  createTestPatternList,
} from "@/utils/testFactories";
import { renderHookWithProviders, waitFor } from "@/utils/renderWithProviders";

const video = (value: string) => ({ type: "local" as const, value });

const wcs = createTestPatternList({ name: "WCS Level 1" });
const festival = createTestPatternList({ name: "Festival" });

const patterns = {
  [wcs.id]: [
    createTestPattern(wcs.patternTypes[0].id, {
      id: 1,
      name: "Sugar Push",
      videoRefs: [video("push.mp4")],
    }),
  ],
  [festival.id]: [
    createTestPattern(festival.patternTypes[0].id, {
      id: 1,
      name: "Left Side Pass",
      videoRefs: [video("pass.mp4")],
    }),
  ],
};

describe("useReels, every list", () => {
  it("never shows the newly opened list twice while the other lists are stale", async () => {
    // Every render's keys: a duplicate in any one of them is React's "two children with the
    // same key", even if the next render has it right again.
    const renders: string[][] = [];
    const { result } = renderHookWithProviders(
      () => {
        const reels = useReels("all");
        renders.push(reels.reels.map((reel) => reel.key));
        return { reels, context: useActivePatternList() };
      },
      { lists: [wcs, festival], patterns },
    );

    await waitFor(() => expect(result.current.reels.reels).toHaveLength(2));

    // The other lists were read while WCS was open, so they still hold Festival when it opens.
    await act(() => result.current.context.setActiveList(festival));
    await waitFor(() =>
      expect(result.current.reels.reels[0].listId).toBe(festival.id),
    );

    for (const keys of renders) {
      expect(new Set(keys).size).toBe(keys.length);
    }
    expect(result.current.reels.reels.map((reel) => reel.listId)).toEqual([
      festival.id,
      wcs.id,
    ]);
  });
});
