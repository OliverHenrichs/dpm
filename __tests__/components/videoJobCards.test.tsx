import React from "react";
import { jobStore } from "@/src/anonymize/jobs/jobStore";
import type { AnonymizeJob } from "@/src/anonymize/jobs/AnonymizeJobsContext";
import DraftJobLines from "@/src/anonymize/components/DraftJobLines";
import SequenceVideo, {
  SEQUENCE_VIDEO_MAX_HEIGHT,
} from "@/src/pattern/sequences/SequenceVideo";
import { ProgressBar } from "@/src/common/ui";
import { setReducedMotion } from "@/__mocks__/react-native-reanimated";
import {
  fireEvent,
  renderWithProviders,
  screen,
} from "@/utils/renderWithProviders";

const job = (overrides: Partial<AnonymizeJob>): AnonymizeJob => ({
  id: "j1",
  kind: "shorten",
  listId: "list",
  patternName: "Sugar Push",
  sourceUri: "file:///document/a.mp4",
  status: "running",
  progress: 0,
  ...overrides,
});

const player = {
  playerRef: { current: null },
  onTime: jest.fn(),
  onPlayingChange: jest.fn(),
  onEnded: jest.fn(),
};

const layOut = (width: number) =>
  fireEvent(screen.getByTestId("sequence-video"), "layout", {
    nativeEvent: { layout: { x: 0, y: 0, width, height: 0 } },
  });

describe("the sequence video's frame", () => {
  it("keeps the full width once the height is capped, and centres YouTube in it", () => {
    renderWithProviders(
      <SequenceVideo
        video={{ type: "url", value: "https://youtu.be/abc123" }}
        {...player}
      />,
    );
    layOut(600);

    const frame = screen.getByTestId("sequence-video");
    // Not an aspect ratio, which made Yoga take the width back from the capped height.
    expect(frame).toHaveStyle({
      width: "100%",
      height: SEQUENCE_VIDEO_MAX_HEIGHT,
      alignItems: "center",
    });
    expect(frame).not.toHaveStyle({ aspectRatio: 16 / 9 });
    // The player is 16:9 of the capped height, the frame's black either side of it.
    const youtube = screen.UNSAFE_getByType(
      "YoutubePlayer" as unknown as React.ComponentType,
    );
    expect(youtube.props.width).toBe(Math.round((220 * 16) / 9));
    expect(youtube.props.height).toBe(220);
  });

  it("gives YouTube the whole width below the cap", () => {
    renderWithProviders(
      <SequenceVideo
        video={{ type: "url", value: "https://youtu.be/abc123" }}
        {...player}
      />,
    );
    layOut(320);
    const youtube = screen.UNSAFE_getByType(
      "YoutubePlayer" as unknown as React.ComponentType,
    );
    expect(youtube.props.width).toBe(320);
    expect(youtube.props.height).toBe(180);
  });
});

describe("a form's job cards", () => {
  afterEach(() => jest.restoreAllMocks());

  it("shows a running cut's count as a progress bar", () => {
    renderWithProviders(
      <DraftJobLines
        jobs={[job({ status: "running", progress: 0.42 })]}
        onReview={jest.fn()}
      />,
    );
    expect(screen.getByText("Shortening the video … 42 %")).toBeOnTheScreen();
    expect(screen.getByText("Running")).toBeOnTheScreen();
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAccessibilityValue({ min: 0, max: 100, now: 42 });
    expect(bar).toHaveAccessibleName("Shortening the video … 42 %");
    // A running cut cannot be stopped.
    expect(screen.queryByText("Cancel job")).toBeNull();
    expect(screen.getByText(/^These run on the phone/)).toBeOnTheScreen();
  });

  it("sweeps for an AI that writes without a count", () => {
    renderWithProviders(
      <DraftJobLines
        jobs={[job({ kind: "suggest", status: "running", phase: "thinking" })]}
        onReview={jest.fn()}
      />,
    );
    expect(
      screen.getByText("The AI is writing a suggestion …"),
    ).toBeOnTheScreen();
    const bar = screen.getByRole("progressbar");
    expect(bar.props.accessibilityValue).toBeUndefined();
    expect(bar).toBeBusy();
  });

  it("holds the sweep still with reduced motion", () => {
    setReducedMotion(true);
    renderWithProviders(
      <ProgressBar accessibilityLabel="Writing" tone="success" />,
    );
    expect(screen.getByRole("progressbar")).toBeBusy();
    fireEvent(screen.getByTestId("progress-sweep"), "layout", {
      nativeEvent: { layout: { x: 0, y: 0, width: 200, height: 4 } },
    });
    // The segment rests in the middle of the track.
    expect(screen.getByTestId("progress-sweep").children).toHaveLength(1);
    setReducedMotion(false);
  });

  it("cancels a queued job from its card", () => {
    const cancel = jest.spyOn(jobStore, "cancel").mockImplementation(() => {});
    renderWithProviders(
      <DraftJobLines
        jobs={[job({ kind: "transcribe", status: "queued" })]}
        onReview={jest.fn()}
      />,
    );
    expect(screen.getByText("Queued")).toBeOnTheScreen();
    expect(screen.getByRole("progressbar")).toHaveAccessibilityValue({
      now: 0,
    });
    fireEvent.press(screen.getByText("Cancel job"));
    expect(cancel).toHaveBeenCalledWith("j1");
  });

  it("offers Review once a result waits, and says why a job failed", () => {
    const onReview = jest.fn();
    renderWithProviders(
      <DraftJobLines
        jobs={[
          job({ id: "r", status: "review", progress: 1 }),
          job({
            id: "f",
            kind: "transcribe",
            status: "failed",
            errorKey: "transcribeErrorNoSound",
          }),
        ]}
        onReview={onReview}
      />,
    );
    expect(screen.getByText("Ready to review")).toBeOnTheScreen();
    expect(screen.getByText("Failed")).toBeOnTheScreen();
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.queryByText(/^These run on the phone/)).toBeNull();
    fireEvent.press(screen.getByText("Review"));
    expect(onReview).toHaveBeenCalledWith("r");
  });
});
