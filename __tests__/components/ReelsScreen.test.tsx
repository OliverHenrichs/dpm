import React from "react";
import { useVideoPlayer } from "expo-video";
import ReelsScreen from "@/src/reels/ReelsScreen";
import {
  createTestPattern,
  createTestPatternList,
} from "@/utils/testFactories";
import {
  fireEvent,
  renderWithProviders,
  screen,
  waitFor,
} from "@/utils/renderWithProviders";

const video = (value: string) => ({ type: "local" as const, value });

const wcs = createTestPatternList({ name: "WCS Level 1" });
const festival = createTestPatternList({ name: "Festival" });

const patterns = {
  [wcs.id]: [
    createTestPattern(wcs.patternTypes[0].id, {
      id: 1,
      name: "Sugar Push",
      videoRefs: [video("push.mp4"), video("push-2.mp4")],
    }),
    createTestPattern(wcs.patternTypes[0].id, { id: 2, name: "Whip" }),
  ],
  [festival.id]: [
    createTestPattern(festival.patternTypes[0].id, {
      id: 1,
      name: "Underarm Turn",
      videoRefs: [video("turn.mp4")],
    }),
  ],
};

/** The stage only lays the pages out once it knows its size. */
function layOut() {
  fireEvent(screen.getByTestId("reels-stage"), "layout", {
    nativeEvent: { layout: { x: 0, y: 0, width: 360, height: 640 } },
  });
}

describe("ReelsScreen", () => {
  it("shows the open list's patterns that have videos", async () => {
    renderWithProviders(<ReelsScreen />, { lists: [wcs, festival], patterns });

    await screen.findByText("WCS Level 1");
    layOut();

    expect(screen.getByText("Sugar Push")).toBeOnTheScreen();
    expect(screen.queryByText("Whip")).toBeNull();
    expect(screen.queryByText("Underarm Turn")).toBeNull();
    expect(screen.getByLabelText("Video 1 of 2")).toBeOnTheScreen();
  });

  it("plays and pauses on a tap", async () => {
    renderWithProviders(<ReelsScreen />, { lists: [wcs], patterns });
    await screen.findByText("WCS Level 1");
    layOut();

    // The mock hands out a new player per render; the one in hand at the tap is the one used.
    const latestPlayer = () =>
      jest.mocked(useVideoPlayer).mock.results.at(-1)?.value;
    const player = latestPlayer();
    fireEvent.press(screen.getByRole("button", { name: "Play video" }));
    expect(player.play).toHaveBeenCalled();

    const playing = latestPlayer();
    fireEvent.press(screen.getByRole("button", { name: "Pause video" }));
    expect(playing.pause).toHaveBeenCalled();
  });

  it("takes in every list when asked", async () => {
    renderWithProviders(<ReelsScreen />, { lists: [wcs, festival], patterns });
    await screen.findByText("WCS Level 1");

    fireEvent.press(screen.getByText("All lists"));
    layOut();

    await waitFor(() =>
      expect(screen.getByText("Underarm Turn")).toBeOnTheScreen(),
    );
    expect(screen.getByText(/Festival/)).toBeOnTheScreen();
  });

  it("says so when the list has no videos", async () => {
    renderWithProviders(<ReelsScreen />, {
      lists: [festival, wcs],
      patterns: { [festival.id]: [], [wcs.id]: patterns[wcs.id] },
    });

    expect(
      await screen.findByText(/No videos in this list yet/),
    ).toBeOnTheScreen();
  });
});
