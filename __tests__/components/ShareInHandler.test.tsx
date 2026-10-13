import React from "react";
import ShareInHandler from "@/src/videoLinks/components/ShareInHandler";
import { clearReplacements } from "@/src/anonymize/jobs/replaceVideo";
import { loadPatterns } from "@/src/pattern/data/PatternListStorage";
import { awaitingLink } from "@/src/videoLinks/awaitingLink";
import {
  createTestPattern,
  createTestPatternList,
  createTestPatternType,
} from "@/utils/testFactories";
import {
  fireEvent,
  renderWithProviders,
  screen,
  waitFor,
} from "@/utils/renderWithProviders";

// A build with the share-in native module, sharing what each test sets.
jest.mock("@/src/videoLinks/canReceiveShares", () => ({
  canReceiveShares: true,
}));
let mockShare: { text?: string; webUrl?: string | null } = {};
const mockReset = jest.fn();
jest.mock("expo-share-intent", () => ({
  useShareIntent: () => ({
    hasShareIntent: true,
    shareIntent: mockShare,
    resetShareIntent: mockReset,
  }),
}));

const TYPE = createTestPatternType({ slug: "push" });
const SOURCE = "file:///document/video-a.mp4";
const LINK = "https://youtu.be/abc123";

function renderHandler() {
  const list = createTestPatternList({ patternTypes: [TYPE], name: "WCS" });
  const pattern = createTestPattern(TYPE.id, {
    id: 1,
    name: "Whip",
    videoRefs: [{ type: "local", value: SOURCE }],
  });
  renderWithProviders(<ShareInHandler />, {
    lists: [list],
    patterns: { [list.id]: [pattern] },
  });
  return { list };
}

afterEach(() => {
  awaitingLink.clear();
  clearReplacements();
});

describe("ShareInHandler", () => {
  it("offers a link that comes back for the video sent out, and swaps it in", async () => {
    mockShare = { text: `Watch on YouTube: ${LINK}`, webUrl: LINK };
    const list = createTestPatternList({ patternTypes: [TYPE] });
    awaitingLink.set({
      listId: list.id,
      sourceUri: SOURCE,
      patternName: "Whip",
    });
    renderWithProviders(<ShareInHandler />, {
      lists: [list],
      patterns: {
        [list.id]: [
          createTestPattern(TYPE.id, {
            id: 1,
            name: "Whip",
            videoRefs: [{ type: "local", value: SOURCE }],
          }),
        ],
      },
    });

    expect(await screen.findByText("Use this link?")).toBeOnTheScreen();
    expect(mockReset).toHaveBeenCalled();
    fireEvent.press(screen.getByText("Use link"));

    await waitFor(async () =>
      expect((await loadPatterns(list.id))[0].videoRefs).toEqual([
        { type: "url", value: LINK },
      ]),
    );
    expect(awaitingLink.get()).toBeNull();
  });

  it("places the link elsewhere when it is not for that video", async () => {
    mockShare = { text: LINK, webUrl: LINK };
    awaitingLink.set({ listId: "l", sourceUri: SOURCE, patternName: "Whip" });
    renderHandler();

    fireEvent.press(await screen.findByText("Add elsewhere"));

    expect(await screen.findByText("Add the shared video")).toBeOnTheScreen();
  });

  it("asks where a link goes when no video waits for one", async () => {
    mockShare = { text: LINK, webUrl: LINK };
    const { list } = renderHandler();

    fireEvent.press(await screen.findByText("Whip"));

    expect(await screen.findByText("Video added")).toBeOnTheScreen();
    expect((await loadPatterns(list.id))[0].videoRefs).toEqual([
      { type: "local", value: SOURCE },
      { type: "url", value: LINK },
    ]);
  });

  it("says when nothing shared can be used", async () => {
    mockShare = { text: "See you Thursday!" };
    renderHandler();

    expect(await screen.findByText("Nothing to add")).toBeOnTheScreen();
  });
});
