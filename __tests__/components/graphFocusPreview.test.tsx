import React from "react";
import { View } from "react-native";
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
} from "@testing-library/react-native";
import { makeMutable } from "@/__mocks__/react-native-reanimated";
import {
  findGesture,
  peekGestures,
} from "@/__mocks__/react-native-gesture-handler";
import FocusPreviewCard from "@/src/pattern/graph/components/FocusPreviewCard";
import FocusPreviewVideo, {
  PREVIEW_VIDEO_DWELL_MS,
} from "@/src/pattern/graph/components/FocusPreviewVideo";
import ZoomableCanvas from "@/src/pattern/graph/components/ZoomableCanvas";
import { useCanvasTransformValues } from "@/src/pattern/graph/components/CanvasTransformContext";
import { useFocusPreview } from "@/src/pattern/graph/hooks/useFocusPreview";
import { buildGraphModel } from "@/src/pattern/graph/model/GraphModel";
import { translationToCentre } from "@/src/pattern/graph/model/focus";
import { LayoutPosition } from "@/src/pattern/graph/utils/GraphUtils";
import { IVideoReference } from "@/src/pattern/types/IPatternList";
import {
  createTestPattern,
  createTestPatternType,
} from "@/utils/testFactories";

const TYPE = createTestPatternType({ slug: "Whip" });
const LOCAL: IVideoReference = { type: "local", value: "file:///whip.mp4" };
const YOUTUBE: IVideoReference = {
  type: "url",
  value: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
};

const nodeFor = (overrides: Parameters<typeof createTestPattern>[1] = {}) =>
  buildGraphModel(
    [createTestPattern(TYPE.id, { id: 1, name: "Basic whip", ...overrides })],
    [TYPE],
  ).nodes[0];

const renderCard = (
  overrides: Parameters<typeof createTestPattern>[1] = {},
  onOpen = jest.fn(),
) => {
  render(
    <FocusPreviewCard
      node={nodeFor(overrides)}
      typeName="Whip"
      before={2}
      after={3}
      panning={makeMutable(false)}
      onOpen={onOpen}
    />,
  );
  return onOpen;
};

describe("FocusPreviewCard", () => {
  it("names the pattern, its type and what it connects to", () => {
    renderCard({ counts: 8, description: "Turns the follower around." });

    expect(screen.getByText("Basic whip")).toBeTruthy();
    expect(screen.getByText("Whip")).toBeTruthy();
    expect(screen.getByText("Turns the follower around.")).toBeTruthy();
    expect(screen.getByText("prerequisites 2 · buildsInto 3")).toBeTruthy();
  });

  it("opens the pattern in full on one tap", () => {
    const onOpen = renderCard();

    fireEvent.press(screen.getByLabelText("focusPreviewOpen"));

    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("leaves the video out for a pattern without one", () => {
    renderCard({ videoRefs: [] });

    expect(screen.UNSAFE_queryAllByType(FocusPreviewVideo)).toHaveLength(0);
  });

  it("previews the pattern's first video", () => {
    renderCard({ videoRefs: [LOCAL, YOUTUBE] });

    expect(screen.UNSAFE_getByType(FocusPreviewVideo).props.video).toBe(LOCAL);
  });
});

describe("FocusPreviewVideo", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const players = () => screen.UNSAFE_queryAllByType("VideoView" as never);

  it("waits for the focus to settle before starting a player", () => {
    // Panning across a dense graph would otherwise start a decoder for every
    // pattern it passed.
    render(<FocusPreviewVideo video={LOCAL} />);
    expect(players()).toHaveLength(0);

    act(() => jest.advanceTimersByTime(PREVIEW_VIDEO_DWELL_MS));

    expect(players()).toHaveLength(1);
  });

  it("starts the video muted and looping", () => {
    const { useVideoPlayer } = jest.requireMock("expo-video");
    render(<FocusPreviewVideo video={LOCAL} />);
    act(() => jest.advanceTimersByTime(PREVIEW_VIDEO_DWELL_MS));

    const setup = useVideoPlayer.mock.calls.at(-1)[1];
    const player = { play: jest.fn(), bufferOptions: {} } as Record<
      string,
      unknown
    >;
    setup(player);

    expect(player).toMatchObject({ muted: true, loop: true });
    expect(player.play).toHaveBeenCalled();
  });

  it("keeps a YouTube link to its still", () => {
    render(<FocusPreviewVideo video={YOUTUBE} />);

    act(() => jest.advanceTimersByTime(PREVIEW_VIDEO_DWELL_MS * 2));

    expect(players()).toHaveLength(0);
  });
});

describe("useFocusPreview", () => {
  const CONTENT = { width: 2000, height: 1600 };
  const POSITIONS = new Map<number, LayoutPosition>([[4, { x: 700, y: 300 }]]);

  const setup = () =>
    renderHook(() => {
      const transform = useCanvasTransformValues(1, 0, 0);
      return {
        transform,
        focus: useFocusPreview(
          transform,
          POSITIONS,
          CONTENT.width,
          CONTENT.height,
        ),
      };
    });

  it("follows the pan: on while the finger is down, off on release", () => {
    const { result } = setup();

    result.current.focus.onPanStart();
    expect(result.current.focus.panning.get()).toBe(true);

    result.current.focus.onPanEnd();
    expect(result.current.focus.panning.get()).toBe(false);
  });

  it("leaves the canvas where it is on release with nothing in focus", () => {
    const { result } = setup();
    result.current.transform.translateX.set(123);

    result.current.focus.onPanStart();
    result.current.focus.onPanEnd();

    expect(result.current.transform.translateX.get()).toBe(123);
  });

  it("opens nothing from the mark with nothing in focus", () => {
    const { result } = setup();
    result.current.transform.viewportWidth.set(400);
    result.current.transform.viewportHeight.set(800);

    expect(result.current.focus.focusedAtMark(200, 400)).toBeNull();
  });

  it("knows where the canvas must go to centre a node", () => {
    // What the release eases to: checked here because the reaction that sets
    // the focus does not run under jest.
    expect(translationToCentre(POSITIONS.get(4)!, 1, CONTENT)).toEqual({
      translateX: 300,
      translateY: 500,
    });
  });
});

describe("ZoomableCanvas's pan callbacks", () => {
  it("reports the canvas pan starting and ending", () => {
    const onPanStart = jest.fn();
    const onPanEnd = jest.fn();
    const Harness = () => {
      const transform = useCanvasTransformValues(1, 0, 0);
      return (
        <ZoomableCanvas
          contentWidth={100}
          contentHeight={100}
          initialZoom={1}
          initialOffsetX={0}
          initialOffsetY={0}
          transform={transform}
          onPanStart={onPanStart}
          onPanEnd={onPanEnd}
          overlay={<View testID="overlay" />}
        >
          <View />
        </ZoomableCanvas>
      );
    };
    render(<Harness />);
    const pan = findGesture(peekGestures()[0], "pan")!;

    pan.handlers.onStart({});
    pan.handlers.onEnd({});

    expect(onPanStart).toHaveBeenCalledTimes(1);
    expect(onPanEnd).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("overlay")).toBeTruthy();
  });
});
