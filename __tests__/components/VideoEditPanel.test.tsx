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
  act(() =>
    listeners.sourceLoad({
      duration,
      availableVideoTracks: [{ size: { width: 1920, height: 1080 } }],
    }),
  );
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

/** Goes on to the tap frame and taps both dancers. */
function tapBothDancers() {
  fireEvent.press(screen.getByRole("tab", { name: "Anonymize" }));
  fireEvent.press(button("Next: tap the dancers"));
  fireEvent(screen.getByTestId("video-preview"), "layout", {
    nativeEvent: { layout: { width: 320, height: 180 } },
  });
  for (const x of [100, 200]) {
    fireEvent.press(screen.getByTestId("prompt-overlay"), {
      nativeEvent: { locationX: x, locationY: 90 },
    });
  }
}

describe("Anonymize — experimental, with a preview", () => {
  const previewer = () => {
    let finish: (uri: string) => void = () => {};
    let fail: () => void = () => {};
    const render = jest.fn(
      (
        _provider: AnonymizeProvider,
        _request: unknown,
        onProgress: (f: number) => void,
      ) =>
        new Promise<string>((resolve, reject) => {
          onProgress(0.4);
          finish = resolve;
          fail = () => reject(new Error("out of memory"));
        }),
    );
    const discard = jest.fn();
    return {
      previewer: { render, discard },
      render,
      discard,
      finish: (uri: string) => act(async () => finish(uri)),
      fail: () => act(async () => fail()),
    };
  };

  it("says on its tab that it is experimental", () => {
    renderPanel(20);

    fireEvent.press(screen.getByRole("tab", { name: "Anonymize" }));

    expect(screen.getByText("EXPERIMENTAL")).toBeOnTheScreen();
    expect(
      screen.getByText(/^Anonymizing is still experimental/),
    ).toBeOnTheScreen();
  });

  it("offers no preview until every dancer is tapped", () => {
    const p = previewer();
    renderPanel(20, { previewer: p.previewer });

    fireEvent.press(screen.getByRole("tab", { name: "Anonymize" }));
    fireEvent.press(button("Next: tap the dancers"));

    expect(
      screen.queryByRole("button", { name: "Preview the first half second" }),
    ).toBeNull();
  });

  it("renders the selection's start with the taps, then shows it over the frame", async () => {
    const p = previewer();
    renderPanel(20, { previewer: p.previewer });
    tapBothDancers();

    fireEvent.press(button("Preview the first half second"));

    expect(p.render).toHaveBeenCalledWith(
      provider,
      expect.objectContaining({
        startSeconds: 0,
        endSeconds: 20,
        prompts: [expect.anything(), expect.anything()],
      }),
      expect.any(Function),
    );
    expect(button("Rendering the preview … 40 %")).toBeDisabled();
    // The full render can still start without waiting for the preview.
    expect(button("Anonymize 20 s")).toBeEnabled();

    await p.finish("file:///cache/preview.mp4");

    expect(screen.getByTestId("anonymize-preview")).toBeOnTheScreen();
    expect(
      screen.getByText(/^The first half second, slowed down/),
    ).toBeOnTheScreen();
  });

  it("throws the preview away when the dancers are tapped again", async () => {
    const p = previewer();
    renderPanel(20, { previewer: p.previewer });
    tapBothDancers();
    fireEvent.press(button("Preview the first half second"));
    await p.finish("file:///cache/preview.mp4");

    fireEvent.press(button("Tap again"));

    expect(p.discard).toHaveBeenCalledWith("file:///cache/preview.mp4");
    expect(screen.queryByTestId("anonymize-preview")).toBeNull();
  });

  it("throws away a preview that arrives after the taps changed", async () => {
    const p = previewer();
    renderPanel(20, { previewer: p.previewer });
    tapBothDancers();
    fireEvent.press(button("Preview the first half second"));

    fireEvent.press(button("Tap again"));
    await p.finish("file:///cache/stale.mp4");

    expect(p.discard).toHaveBeenCalledWith("file:///cache/stale.mp4");
    expect(screen.queryByTestId("anonymize-preview")).toBeNull();
  });

  it("says when the preview failed, and lets it be tried again", async () => {
    const p = previewer();
    renderPanel(20, { previewer: p.previewer });
    tapBothDancers();
    fireEvent.press(button("Preview the first half second"));

    await p.fail();

    expect(
      screen.getByText(/^The preview could not be rendered/),
    ).toBeOnTheScreen();
    expect(button("Preview the first half second")).toBeEnabled();
  });
});

describe("Anonymize — highlights who each tap picked", () => {
  const outlinedProvider: AnonymizeProvider = {
    ...provider,
    outline: async () => ({ uri: "unused", found: [] }),
  };
  const outliner = () => {
    const pending: {
      resolve: (o: { uri: string; found: boolean[] }) => void;
      reject: () => void;
    }[] = [];
    const find = jest.fn(
      () =>
        new Promise<{ uri: string; found: boolean[] }>((resolve, reject) => {
          pending.push({ resolve, reject: () => reject(new Error("no GPU")) });
        }),
    );
    const discard = jest.fn();
    const prepare = jest.fn(async () => {});
    const release = jest.fn(async () => {});
    return {
      outliner: { find, discard, prepare, release },
      find,
      discard,
      prepare,
      release,
      answer: (i: number, uri: string, found: boolean[]) =>
        act(async () => pending[i].resolve({ uri, found })),
      fail: (i: number) => act(async () => pending[i].reject()),
    };
  };
  const tapFrame = () => {
    fireEvent.press(screen.getByRole("tab", { name: "Anonymize" }));
    fireEvent.press(button("Next: tap the dancers"));
    fireEvent(screen.getByTestId("video-preview"), "layout", {
      nativeEvent: { layout: { width: 320, height: 180 } },
    });
  };
  const tapAt = (x: number) =>
    fireEvent.press(screen.getByTestId("prompt-overlay"), {
      nativeEvent: { locationX: x, locationY: 90 },
    });

  it("outlines the tapped dancers on the tap frame, all taps at once", async () => {
    const o = outliner();
    renderPanel(20, {
      providers: [outlinedProvider],
      outliner: o.outliner,
    });
    tapFrame();

    tapAt(100);

    expect(o.find).toHaveBeenLastCalledWith(outlinedProvider, {
      sourceUri: "file:///document/a.mp4",
      atSeconds: 0,
      prompts: [{ x: 100 / 320, y: 0.5 }],
    });
    expect(screen.getByText(/^Outlining who you tapped/)).toBeOnTheScreen();

    await o.answer(0, "file:///cache/one.jpg", [true]);
    expect(screen.getByTestId("dancer-outline").props.source).toEqual({
      uri: "file:///cache/one.jpg",
    });
    expect(
      screen.getByText(/^The highlighted outline is who will be followed/),
    ).toBeOnTheScreen();

    tapAt(200);
    expect(o.find).toHaveBeenLastCalledWith(
      outlinedProvider,
      expect.objectContaining({
        prompts: [expect.anything(), { x: 200 / 320, y: 0.5 }],
      }),
    );
    // The first outline stays up until the couple's arrives, then makes way for it.
    expect(screen.getByTestId("dancer-outline").props.source).toEqual({
      uri: "file:///cache/one.jpg",
    });
    await o.answer(1, "file:///cache/two.jpg", [true, true]);
    expect(o.discard).toHaveBeenCalledWith("file:///cache/one.jpg");
    expect(screen.getByTestId("dancer-outline").props.source).toEqual({
      uri: "file:///cache/two.jpg",
    });
  });

  it("readies the model as the tap frame opens, and frees it on the way back", () => {
    const o = outliner();
    renderPanel(20, {
      providers: [outlinedProvider],
      outliner: o.outliner,
    });

    tapFrame();
    expect(o.prepare).toHaveBeenCalledWith(outlinedProvider, {
      sourceUri: "file:///document/a.mp4",
      atSeconds: 0,
    });
    expect(o.release).not.toHaveBeenCalled();

    fireEvent.press(button("Back"));
    expect(o.release).toHaveBeenCalledWith(outlinedProvider);
  });

  it("frees the model when the render starts", () => {
    const o = outliner();
    const onAnonymize = jest.fn();
    renderPanel(20, {
      providers: [outlinedProvider],
      outliner: o.outliner,
      onAnonymize,
    });
    tapFrame();
    tapAt(100);
    tapAt(200);

    fireEvent.press(button("Anonymize 20 s"));

    expect(o.release).toHaveBeenCalledWith(outlinedProvider);
    expect(onAnonymize).toHaveBeenCalled();
  });

  it("says which tap found nobody", async () => {
    const o = outliner();
    renderPanel(20, {
      providers: [outlinedProvider],
      outliner: o.outliner,
    });
    tapFrame();
    tapAt(100);
    tapAt(200);

    await o.answer(1, "file:///cache/two.jpg", [true, false]);

    expect(
      screen.getByText(/^Nobody was found where you tapped dancer 2/),
    ).toBeOnTheScreen();
  });

  it("throws the outline away when the dancers are tapped again", async () => {
    const o = outliner();
    renderPanel(20, {
      providers: [outlinedProvider],
      outliner: o.outliner,
    });
    tapFrame();
    tapAt(100);
    await o.answer(0, "file:///cache/one.jpg", [true]);

    fireEvent.press(button("Tap again"));

    expect(o.discard).toHaveBeenCalledWith("file:///cache/one.jpg");
    expect(screen.queryByTestId("dancer-outline")).toBeNull();
    expect(screen.queryByTestId("outline-note")).toBeNull();
  });

  it("throws away an outline that arrives after the taps changed", async () => {
    const o = outliner();
    renderPanel(20, {
      providers: [outlinedProvider],
      outliner: o.outliner,
    });
    tapFrame();
    tapAt(100);

    fireEvent.press(button("Tap again"));
    await o.answer(0, "file:///cache/stale.jpg", [true]);

    expect(o.discard).toHaveBeenCalledWith("file:///cache/stale.jpg");
    expect(screen.queryByTestId("dancer-outline")).toBeNull();
  });

  it("says when the outline failed, and still lets the render start", async () => {
    const o = outliner();
    renderPanel(20, {
      providers: [outlinedProvider],
      outliner: o.outliner,
    });
    tapFrame();
    tapAt(100);
    tapAt(200);

    await o.fail(1);

    expect(
      screen.getByText(/^The outline could not be shown/),
    ).toBeOnTheScreen();
    expect(button("Anonymize 20 s")).toBeEnabled();
  });

  it("shows the taps alone for a provider that cannot outline", () => {
    const o = outliner();
    renderPanel(20, { outliner: o.outliner });
    tapFrame();
    tapAt(100);

    expect(o.find).not.toHaveBeenCalled();
    expect(o.prepare).not.toHaveBeenCalled();
    expect(screen.queryByTestId("outline-note")).toBeNull();
  });
});
