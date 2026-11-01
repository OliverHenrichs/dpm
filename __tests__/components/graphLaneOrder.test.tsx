import React, { act } from "react";
import { StyleSheet } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { subscribeToSharedList } from "@/src/firebase/FirebaseListService";
import PatternGraphScreen from "@/src/pattern/graph/PatternGraphScreen";
import { IPatternList } from "@/src/pattern/types/IPatternList";
import { DRAG_ACTIVATION_MS } from "@/src/pattern/graph/hooks/useNodeDrag";
import { seedAsyncStorage } from "@/__mocks__/@react-native-async-storage/async-storage";
import {
  MockGesture,
  peekGestures,
} from "@/__mocks__/react-native-gesture-handler";
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

jest.mock("@/src/firebase/FirebaseListService", () => ({
  syncPublishedList: jest.fn(),
  subscribeToSharedList: jest.fn(),
}));

beforeEach(() => {
  (subscribeToSharedList as jest.Mock).mockReturnValue(() => {});
  seedAsyncStorage({ "@graphLegendSeen": "true" });
});

const PUSH = createTestPatternType({ slug: "push" });
const PASS = createTestPatternType({ slug: "pass" });
const WHIP = createTestPatternType({ slug: "whip" });
const TYPES = [PUSH, PASS, WHIP];
// One unlinked figure each, so the automatic order is the list's: push, pass, whip.
const PATTERNS = TYPES.map((type, i) =>
  createTestPattern(type.id, { id: i + 1, name: `${type.slug} figure` }),
);

async function renderGraph(overrides: Partial<IPatternList> = {}) {
  const list = createTestPatternList({ patternTypes: TYPES, ...overrides });
  renderWithProviders(<PatternGraphScreen />, {
    lists: [list],
    patterns: { [list.id]: PATTERNS },
  });
  await screen.findByLabelText("Filter Figures");
  await waitFor(() =>
    expect(screen.getAllByLabelText(/^Move the .* lane$/)).toHaveLength(3),
  );
  return list;
}

const storedList = async (listId: string): Promise<IPatternList> => {
  const lists: IPatternList[] = JSON.parse(
    (await AsyncStorage.getItem("@patternLists")) ?? "[]",
  );
  return lists.find((l) => l.id === listId)!;
};

/** The lane grips, top to bottom, by the type they move. */
function gripOrder(): string[] {
  return screen
    .getAllByLabelText(/^Move the .* lane$/)
    .map((grip) => ({
      name: (grip.props.accessibilityLabel as string)
        .replace("Move the ", "")
        .replace(" lane", ""),
      top: StyleSheet.flatten(grip.props.style).top as number,
    }))
    .sort((a, b) => a.top - b.top)
    .map((grip) => grip.name);
}

const gripTop = (type: string) =>
  StyleSheet.flatten(screen.getByLabelText(`Move the ${type} lane`).props.style)
    .top as number;

/** The lane drag: the newest long-press pan registered (the component rebuilds it each render). */
function lanePan(): MockGesture {
  const pans = peekGestures().filter(
    (g) => g.type === "pan" && g.config.activateAfterLongPress !== undefined,
  );
  return pans[pans.length - 1];
}

/** Picks up the lane under `y`, drags it by `dy`, and lets go. */
function dragLane(y: number, dy: number) {
  act(() => {
    lanePan().handlers.onStart({ y });
  });
  act(() => {
    lanePan().handlers.onChange({ changeY: dy });
  });
  act(() => {
    lanePan().handlers.onEnd({});
    lanePan().handlers.onFinalize({}, true);
  });
}

describe("reordering the timeline's lanes", () => {
  it("long-presses the way a graph node does, so a swipe still scrolls", async () => {
    await renderGraph();
    expect(lanePan().config.activateAfterLongPress).toBe(DRAG_ACTIVATION_MS);
    expect(lanePan().config.enabled).toBe(true);
  });

  it("saves the lanes on the list in the order they were dropped", async () => {
    const list = await renderGraph();
    expect(gripOrder()).toEqual(["push", "pass", "whip"]);

    // Push, dragged well below Whip.
    dragLane(gripTop("push") + 10, 2000);

    await waitFor(async () =>
      expect((await storedList(list.id)).laneOrder).toEqual([
        PASS.id,
        WHIP.id,
        PUSH.id,
      ]),
    );
    expect(gripOrder()).toEqual(["pass", "whip", "push"]);
  });

  it("reflows the lanes while the lane is dragged, and lifts its name", async () => {
    await renderGraph();
    const whipTop = gripTop("whip");

    act(() => {
      lanePan().handlers.onStart({ y: gripTop("push") + 10 });
    });
    expect(Haptics.impactAsync).toHaveBeenCalledWith(
      Haptics.ImpactFeedbackStyle.Medium,
    );
    expect(screen.getByTestId("lane-lifted")).toBeOnTheScreen();
    // Its name, in the style's section case.
    expect(screen.getByText(/^push$/i)).toBeOnTheScreen();

    act(() => {
      lanePan().handlers.onChange({ changeY: whipTop + 10 });
    });
    // Before the drop: Pass and Whip have moved up, nothing is saved yet.
    expect(gripOrder()).toEqual(["pass", "whip", "push"]);

    act(() => {
      lanePan().handlers.onEnd({});
      lanePan().handlers.onFinalize({}, true);
    });
    expect(Haptics.impactAsync).toHaveBeenLastCalledWith(
      Haptics.ImpactFeedbackStyle.Light,
    );
    expect(screen.queryByTestId("lane-lifted")).toBeNull();
  });

  it("changes nothing when the lane is put back where it was", async () => {
    const list = await renderGraph();
    dragLane(gripTop("pass") + 10, 5);

    // A drop that lands in place still lets go, without a write.
    expect(Haptics.impactAsync).toHaveBeenLastCalledWith(
      Haptics.ImpactFeedbackStyle.Light,
    );
    expect((await storedList(list.id)).laneOrder).toBeUndefined();
    expect(gripOrder()).toEqual(["push", "pass", "whip"]);
  });

  it("puts the lanes back when the drag is cancelled", async () => {
    const list = await renderGraph();
    act(() => {
      lanePan().handlers.onStart({ y: gripTop("push") + 10 });
    });
    act(() => {
      lanePan().handlers.onChange({ changeY: 2000 });
    });
    act(() => {
      lanePan().handlers.onFinalize({}, false);
    });

    expect(gripOrder()).toEqual(["push", "pass", "whip"]);
    expect((await storedList(list.id)).laneOrder).toBeUndefined();
  });

  it("does nothing for a long press below the last lane", async () => {
    const list = await renderGraph();
    dragLane(100000, -2000);

    expect(Haptics.impactAsync).not.toHaveBeenCalled();
    expect((await storedList(list.id)).laneOrder).toBeUndefined();
  });

  it("moves a lane one place with the screen reader's actions", async () => {
    const list = await renderGraph();

    fireEvent(
      screen.getByLabelText("Move the whip lane"),
      "accessibilityAction",
      {
        nativeEvent: { actionName: "moveUp" },
      },
    );

    await waitFor(async () =>
      expect((await storedList(list.id)).laneOrder).toEqual([
        PUSH.id,
        WHIP.id,
        PASS.id,
      ]),
    );
  });

  it("follows a saved order, and resets to the automatic one", async () => {
    const list = await renderGraph({ laneOrder: [WHIP.id, PUSH.id, PASS.id] });
    expect(gripOrder()).toEqual(["whip", "push", "pass"]);

    fireEvent.press(screen.getByLabelText("Reset lanes to automatic order"));
    fireEvent.press(screen.getByText("Reset"));

    await waitFor(async () =>
      expect(await storedList(list.id)).not.toHaveProperty("laneOrder"),
    );
    await waitFor(() => expect(gripOrder()).toEqual(["push", "pass", "whip"]));
    expect(
      screen.queryByLabelText("Reset lanes to automatic order"),
    ).toBeNull();
  });

  it("offers no reset while the order is automatic, nor in the network view", async () => {
    await renderGraph();
    expect(
      screen.queryByLabelText("Reset lanes to automatic order"),
    ).toBeNull();
  });

  it("offers the reset in the timeline only", async () => {
    await renderGraph({ laneOrder: [WHIP.id, PUSH.id, PASS.id] });
    expect(
      screen.getByLabelText("Reset lanes to automatic order"),
    ).toBeOnTheScreen();

    fireEvent.press(screen.getByText("Toggle View"));

    expect(await screen.findByText("Network")).toBeOnTheScreen();
    expect(
      screen.queryByLabelText("Reset lanes to automatic order"),
    ).toBeNull();
  });

  it("keeps a read-only list's lanes where they are", async () => {
    const list = createTestPatternList({
      patternTypes: TYPES,
      readonly: true,
      laneOrder: [WHIP.id, PUSH.id, PASS.id],
    });
    renderWithProviders(<PatternGraphScreen />, {
      lists: [list],
      patterns: { [list.id]: PATTERNS },
    });
    // The legend's lane key is there once the list has loaded.
    await screen.findByLabelText("Filter Figures");
    fireEvent.press(screen.getByText("Legend"));
    await screen.findByText("whip lane");

    expect(screen.queryByTestId("lane-handle-column")).toBeNull();
    expect(screen.queryByLabelText(/^Move the .* lane$/)).toBeNull();
    expect(
      screen.queryByLabelText("Reset lanes to automatic order"),
    ).toBeNull();
  });
});
