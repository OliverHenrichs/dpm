import React from "react";
import { Text } from "react-native";
import { useVideoPlayer } from "expo-video";
import { act } from "@testing-library/react-native";
import VideoEditPanel from "@/src/anonymize/components/VideoEditPanel";
import { AnonymizeProvider } from "@/src/anonymize/providers/AnonymizeProvider";
import {
  renderWithProviders,
  screen,
  fireEvent,
} from "@/utils/renderWithProviders";

const provider: AnonymizeProvider = {
  id: "fake",
  labelKey: "anonymizeProviderTracking",
  minSeconds: 1,
  maxSeconds: 30,
  sendsFootageOffDevice: false,
  promptCount: 2,
  isAvailable: () => true,
  run: async () => ({ uri: "file:///out.mp4" }),
};

/** Renders the panel and loads a clip of [duration] seconds into its player. */
function renderPanel(
  duration: number,
  extra: Partial<React.ComponentProps<typeof VideoEditPanel>> = {},
) {
  const listeners: Record<string, (e: unknown) => void> = {};
  (useVideoPlayer as jest.Mock).mockReturnValue({
    currentTime: 0,
    play: jest.fn(),
    pause: jest.fn(),
    seekBy: jest.fn(),
    addListener: jest.fn((name: string, fn: (e: unknown) => void) => {
      listeners[name] = fn;
      return { remove: jest.fn() };
    }),
  });
  const onShorten = jest.fn();
  renderWithProviders(
    <VideoEditPanel
      sourceUri="file:///document/a.mp4"
      providers={[provider]}
      onShorten={onShorten}
      onAnonymize={jest.fn()}
      {...extra}
    />,
  );
  act(() => listeners.sourceLoad({ duration, availableVideoTracks: [] }));
  return { onShorten };
}

const button = (name: string) => screen.getByRole("button", { name });

describe("Edit video — one job per tab", () => {
  it("opens on Shorten, which waits for a part to be picked and says how", () => {
    renderPanel(40);

    expect(
      screen.getByText(/^Keeps only the part you choose/),
    ).toBeOnTheScreen();
    expect(screen.getByText("Part to keep")).toBeOnTheScreen();
    expect(button("Shorten")).toBeDisabled();
    expect(
      screen.getByText(
        "Drag either end of the bar to choose the part to keep.",
      ),
    ).toBeOnTheScreen();
  });

  it("shows the options it is given for the cut on the tab's own job", () => {
    renderPanel(40, {
      cutOptions: (cut) => <Text>{`option for ${cut}`}</Text>,
    });

    expect(screen.getByText("option for shorten")).toBeOnTheScreen();
    fireEvent.press(screen.getByRole("tab", { name: "Anonymize" }));
    expect(screen.getByText("option for anonymize")).toBeOnTheScreen();
  });

  it("names Anonymize's limit and says why it cannot start on a long selection", () => {
    renderPanel(40);

    fireEvent.press(screen.getByRole("tab", { name: "Anonymize" }));

    expect(screen.getByText("40 s · up to 30 s")).toBeOnTheScreen();
    expect(button("Next: tap the dancers")).toBeDisabled();
    expect(
      screen.getByText(/Anonymizing works on up to 30 s/),
    ).toBeOnTheScreen();
  });

  it("goes on to the dancers when the selection fits", () => {
    renderPanel(20);

    fireEvent.press(screen.getByRole("tab", { name: "Anonymize" }));
    fireEvent.press(button("Next: tap the dancers"));

    expect(
      screen.getByText(/^Tap each dancer on this frame/),
    ).toBeOnTheScreen();
    expect(button("Anonymize 20 s")).toBeDisabled();
    expect(screen.queryByRole("tab")).toBeNull();
  });

  it("shows the speech content without the trim bar", () => {
    renderPanel(40, { speech: () => <Text>speech content</Text> });

    fireEvent.press(screen.getByRole("tab", { name: "Speech" }));

    expect(screen.getByText("speech content")).toBeOnTheScreen();
    expect(screen.queryByText("Part to keep")).toBeNull();
  });

  it("leaves out the tabs when shortening is all there is", () => {
    renderPanel(40, { providers: [] });

    expect(screen.queryByRole("tab")).toBeNull();
    expect(button("Shorten")).toBeOnTheScreen();
  });
});
