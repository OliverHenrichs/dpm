import React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useVideoPlayer } from "expo-video";
import { subscribeToSharedList } from "@/src/firebase/FirebaseListService";
import { AnonymizeJobsProvider } from "@/src/anonymize/jobs/AnonymizeJobsContext";
import PatternListManager from "@/src/pattern/list/PatternListManager";
import {
  IPatternList,
  ISequence,
  IVideoReference,
} from "@/src/pattern/types/IPatternList";
import {
  createTestPattern,
  createTestPatternList,
  createTestPatternType,
} from "@/utils/testFactories";
import {
  act,
  fireEvent,
  renderWithProviders,
  screen,
  waitFor,
} from "@/utils/renderWithProviders";

jest.mock("@/src/firebase/FirebaseListService", () => ({
  syncPublishedList: jest.fn(),
  subscribeToSharedList: jest.fn(),
}));

/**
 * An `expo-video` player a test drives: it holds a time, moves it on `seekBy`, and lets the
 * test emit the events `useEventListener` subscribed to.
 */
function fakePlayer() {
  const listeners = new Map<string, ((payload: unknown) => void)[]>();
  const player = {
    currentTime: 0,
    loop: false,
    play: jest.fn(),
    pause: jest.fn(),
    seekBy: jest.fn((by: number) => {
      player.currentTime += by;
    }),
    addListener: jest.fn((event: string, fn: (payload: unknown) => void) => {
      listeners.set(event, [...(listeners.get(event) ?? []), fn]);
      return {
        remove: () =>
          listeners.set(
            event,
            (listeners.get(event) ?? []).filter((l) => l !== fn),
          ),
      };
    }),
    emit: (event: string, payload?: unknown) =>
      act(() => (listeners.get(event) ?? []).forEach((fn) => fn(payload))),
    /** Playback reaches `seconds`, as the player reports it. */
    playTo: (seconds: number) => {
      player.currentTime = seconds;
      player.emit("timeUpdate", { currentTime: seconds });
    },
  };
  return player;
}

let player: ReturnType<typeof fakePlayer>;

beforeEach(() => {
  (subscribeToSharedList as jest.Mock).mockReturnValue(() => {});
  player = fakePlayer();
  jest.mocked(useVideoPlayer).mockImplementation(() => player as never);
});

const PUSH = createTestPatternType({ slug: "push" });
const sugarPush = createTestPattern(PUSH.id, {
  id: 1,
  name: "Sugar Push",
  counts: 6,
});
const basicWhip = createTestPattern(PUSH.id, {
  id: 2,
  name: "Basic Whip",
  counts: 8,
});
const PATTERNS = [sugarPush, basicWhip];

const LOCAL: IVideoReference = {
  type: "local",
  value: "file:///docs/rallye.mp4",
};
const VIMEO: IVideoReference = {
  type: "url",
  value: "https://vimeo.com/123456789",
};

const rallye = (overrides: Partial<ISequence> = {}): ISequence => ({
  id: "rallye",
  name: "Rallye 2026",
  createdAt: 1,
  steps: [
    { kind: "figure", id: "a", patternId: 1 },
    { kind: "figure", id: "b", patternId: 2 },
    { kind: "free", id: "c", text: "pose", counts: 2 },
  ],
  ...overrides,
});
const marked = rallye({
  video: LOCAL,
  steps: [
    { kind: "figure", id: "a", patternId: 1, at: 0 },
    { kind: "figure", id: "b", patternId: 2, at: 4 },
    { kind: "free", id: "c", text: "pose", counts: 2, at: 9 },
  ],
});

async function renderSequences(listOverrides: Partial<IPatternList> = {}) {
  const list = createTestPatternList({
    patternTypes: [PUSH],
    ...listOverrides,
  });
  renderWithProviders(
    <AnonymizeJobsProvider>
      <PatternListManager />
    </AnonymizeJobsProvider>,
    { lists: [list], patterns: { [list.id]: PATTERNS } },
  );
  await screen.findByText(PATTERNS[1].name);
  fireEvent.press(screen.getByRole("tab", { name: /^Sequences/ }));
  return list;
}

/** The player mounts once its frame has a width. */
function layOutVideo() {
  fireEvent(screen.getByTestId("sequence-video"), "layout", {
    nativeEvent: { layout: { x: 0, y: 0, width: 320, height: 180 } },
  });
}

const storedList = async (listId: string): Promise<IPatternList> => {
  const lists: IPatternList[] = JSON.parse(
    (await AsyncStorage.getItem("@patternLists")) ?? "[]",
  );
  return lists.find((l) => l.id === listId)!;
};

const stepRow = (n: number, name: string, time: string) =>
  screen.getByLabelText(`Play step ${n}, ${name}, from ${time}`);

describe("a sequence's video", () => {
  it("shows a badge on the overview row", async () => {
    await renderSequences({ sequences: [marked] });
    expect(screen.getByLabelText("Has a video")).toBeOnTheScreen();
  });

  it("plays a step from its mark, and follows the video while it plays", async () => {
    await renderSequences({ sequences: [marked] });
    fireEvent.press(screen.getByText("Rallye 2026"));
    layOutVideo();

    expect(screen.getByText("0:04.0")).toBeOnTheScreen();
    fireEvent.press(stepRow(2, "Basic Whip", "0:04.0"));
    expect(player.seekBy).toHaveBeenLastCalledWith(4);
    expect(player.play).toHaveBeenCalled();
    expect(stepRow(2, "Basic Whip", "0:04.0")).toBeSelected();

    player.emit("playingChange", { isPlaying: true });
    player.playTo(9.2);
    expect(stepRow(3, "pose", "0:09.0")).toBeSelected();
    expect(stepRow(2, "Basic Whip", "0:04.0")).not.toBeSelected();
  });

  it("loops a step from its mark to the next one", async () => {
    await renderSequences({ sequences: [marked] });
    fireEvent.press(screen.getByText("Rallye 2026"));
    layOutVideo();

    fireEvent.press(stepRow(2, "Basic Whip", "0:04.0"));
    fireEvent.press(screen.getByRole("togglebutton", { name: "Loop step" }));
    player.emit("playingChange", { isPlaying: true });
    player.playTo(6);
    expect(player.currentTime).toBe(6);
    // Reaching the next step's mark goes back to this one's.
    player.playTo(9.05);
    expect(player.currentTime).toBe(4);
    expect(stepRow(2, "Basic Whip", "0:04.0")).toBeSelected();

    fireEvent.press(screen.getByRole("togglebutton", { name: "Loop step" }));
    player.playTo(9.05);
    expect(player.currentTime).toBe(9.05);
  });

  it("marks the steps one tap at a time while the video plays, with Back", async () => {
    const list = await renderSequences({ sequences: [rallye()] });
    fireEvent.press(screen.getByLabelText("Edit Rallye 2026"));

    fireEvent.press(screen.getByText("Add Video"));
    fireEvent.changeText(
      screen.getByPlaceholderText("https://..."),
      "https://example.com/rallye.mp4",
    );
    fireEvent.press(screen.getByText("Add URL"));
    layOutVideo();

    player.currentTime = 7;
    fireEvent.press(screen.getByText("Mark steps"));
    // From the beginning, playing.
    expect(player.currentTime).toBe(0);
    expect(player.play).toHaveBeenCalled();

    player.currentTime = 1.5;
    await act(async () =>
      fireEvent.press(screen.getByText("Mark 1. Sugar Push")),
    );
    player.currentTime = 5;
    await act(async () =>
      fireEvent.press(screen.getByText("Mark 2. Basic Whip")),
    );
    expect(screen.getByText("0:05.0")).toBeOnTheScreen();
    fireEvent.press(screen.getByText("Back"));
    expect(screen.queryByText("0:05.0")).toBeNull();
    player.currentTime = 6;
    await act(async () =>
      fireEvent.press(screen.getByText("Mark 2. Basic Whip")),
    );
    player.currentTime = 10;
    await act(async () => fireEvent.press(screen.getByText("Mark 3. pose")));
    expect(screen.getByText("Every step is marked.")).toBeOnTheScreen();
    fireEvent.press(screen.getByText("Done"));
    expect(player.pause).toHaveBeenCalled();

    // A nudge, and one step marked again on its own where the video is.
    fireEvent.press(screen.getByLabelText("Step 1 half a second later"));
    player.currentTime = 11.25;
    await act(async () =>
      fireEvent.press(screen.getByLabelText("Mark step 3 where the video is")),
    );
    expect(screen.getByText("0:11.3")).toBeOnTheScreen();

    fireEvent.press(screen.getByText("Save sequence"));
    await waitFor(async () =>
      expect((await storedList(list.id)).sequences?.[0].video).toEqual({
        type: "url",
        value: "https://example.com/rallye.mp4",
      }),
    );
    expect(
      (await storedList(list.id)).sequences![0].steps.map((s) => s.at),
    ).toEqual([2, 6, 11.25]);
  });

  it("carries on after the marked steps, from the last mark", async () => {
    await renderSequences({
      sequences: [
        rallye({
          video: LOCAL,
          steps: [
            { kind: "figure", id: "a", patternId: 1, at: 3 },
            { kind: "figure", id: "b", patternId: 2 },
          ],
        }),
      ],
    });
    fireEvent.press(screen.getByLabelText("Edit Rallye 2026"));
    layOutVideo();

    fireEvent.press(screen.getByText("Mark steps"));
    expect(player.currentTime).toBe(3);
    expect(screen.getByText("Mark 2. Basic Whip")).toBeOnTheScreen();
  });

  it("drops the marks with the video", async () => {
    const list = await renderSequences({ sequences: [marked] });
    fireEvent.press(screen.getByLabelText("Edit Rallye 2026"));

    fireEvent.press(screen.getByLabelText("Remove the video"));
    expect(screen.getByText("Add Video")).toBeOnTheScreen();
    fireEvent.press(screen.getByText("Save sequence"));

    await waitFor(async () =>
      expect((await storedList(list.id)).sequences?.[0]).toEqual(rallye()),
    );
  });

  it("plays a Vimeo video without marks, and says so where Mark steps would be", async () => {
    await renderSequences({ sequences: [rallye({ video: VIMEO })] });
    fireEvent.press(screen.getByText("Rallye 2026"));
    layOutVideo();

    const note =
      "Vimeo videos play here, but the steps can't be marked in them or jump to their place.";
    expect(screen.getByText(note)).toBeOnTheScreen();
    expect(screen.queryByText("Loop step")).toBeNull();

    fireEvent.press(screen.getByText("Edit"));
    expect(screen.getByText(note)).toBeOnTheScreen();
    expect(screen.queryByText("Mark steps")).toBeNull();
    expect(screen.queryByLabelText(/where the video is/)).toBeNull();
  });

  it("offers marking in a YouTube video, in YouTube's own player", async () => {
    await renderSequences({
      sequences: [
        rallye({ video: { type: "url", value: "https://youtu.be/abc123" } }),
      ],
    });
    fireEvent.press(screen.getByLabelText("Edit Rallye 2026"));
    layOutVideo();

    expect(screen.UNSAFE_getByType("YoutubePlayer" as never)).toBeTruthy();
    expect(screen.getByText("Mark steps")).toBeOnTheScreen();
    expect(
      screen.getByLabelText("Mark step 1 where the video is"),
    ).toBeOnTheScreen();
  });

  it("plays and seeks on a read-only list, with nothing to mark", async () => {
    await renderSequences({ sequences: [marked], readonly: true });
    fireEvent.press(screen.getByText("Rallye 2026"));
    layOutVideo();

    fireEvent.press(stepRow(3, "pose", "0:09.0"));
    expect(player.seekBy).toHaveBeenLastCalledWith(9);
    expect(screen.getByText("Loop step")).toBeOnTheScreen();
    expect(screen.queryByText("Edit")).toBeNull();
    expect(screen.queryByText("Mark steps")).toBeNull();
  });
});
