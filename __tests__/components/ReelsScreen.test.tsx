import React from "react";
import { BackHandler } from "react-native";
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
    createTestPattern(wcs.patternTypes[0].id, {
      id: 2,
      name: "Underarm Turn",
      videoRefs: [video("turn.mp4")],
    }),
    createTestPattern(wcs.patternTypes[0].id, { id: 3, name: "Whip" }),
  ],
  [festival.id]: [
    createTestPattern(festival.patternTypes[0].id, {
      id: 1,
      name: "Left Side Pass",
      videoRefs: [video("pass.mp4")],
    }),
  ],
};

/** The pages only lay out once the stage, and each page's video area, know their size. */
function layOut() {
  const layout = (width: number, height: number) => ({
    nativeEvent: { layout: { x: 0, y: 0, width, height } },
  });
  fireEvent(screen.getByTestId("reels-stage"), "layout", layout(360, 640));
}

describe("ReelsScreen", () => {
  it("shows the open list's patterns that have videos, several at once", async () => {
    renderWithProviders(<ReelsScreen />, { lists: [wcs, festival], patterns });

    expect(await screen.findByText("Sugar Push")).toBeOnTheScreen();
    expect(screen.getByText("Underarm Turn")).toBeOnTheScreen();
    expect(screen.queryByText("Whip")).toBeNull();
    expect(screen.queryByText("Left Side Pass")).toBeNull();
  });

  it("opens one at a time on a tap, and goes back to the overview", async () => {
    renderWithProviders(<ReelsScreen />, { lists: [wcs], patterns });
    await screen.findByText("Sugar Push");
    layOut();

    fireEvent.press(screen.getByLabelText("Watch Sugar Push"));

    expect(screen.getByLabelText("Back to all reels")).toBeOnTheScreen();
    expect(screen.queryByText("This list")).toBeNull();

    fireEvent.press(screen.getByLabelText("Back to all reels"));
    expect(screen.getByText("This list")).toBeOnTheScreen();
  });

  it("goes back to the overview on Android's back, too", async () => {
    const listeners: (() => boolean)[] = [];
    jest
      .spyOn(BackHandler, "addEventListener")
      .mockImplementation((_, handler) => {
        listeners.push(handler as () => boolean);
        return { remove: jest.fn() };
      });
    renderWithProviders(<ReelsScreen />, { lists: [wcs], patterns });
    await screen.findByText("Sugar Push");
    layOut();
    fireEvent.press(screen.getByLabelText("Watch Underarm Turn"));

    expect(listeners.at(-1)?.()).toBe(true);

    await waitFor(() =>
      expect(screen.getByText("This list")).toBeOnTheScreen(),
    );
  });

  it("takes in every list when asked", async () => {
    renderWithProviders(<ReelsScreen />, { lists: [wcs, festival], patterns });
    await screen.findByText("Sugar Push");

    fireEvent.press(screen.getByText("All lists"));

    expect(await screen.findByText("Left Side Pass")).toBeOnTheScreen();
    expect(screen.getAllByText(/Festival/).length).toBeGreaterThan(0);
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
