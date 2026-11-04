import React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { subscribeToSharedList } from "@/src/firebase/FirebaseListService";
import { AnonymizeJobsProvider } from "@/src/anonymize/jobs/AnonymizeJobsContext";
import PatternListManager from "@/src/pattern/list/PatternListManager";
import {
  IModifier,
  IPattern,
  IPatternList,
  ISequence,
} from "@/src/pattern/types/IPatternList";
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
  act,
  fireEvent,
  renderWithProviders,
  screen,
  waitFor,
  within,
} from "@/utils/renderWithProviders";

jest.mock("@/src/firebase/FirebaseListService", () => ({
  syncPublishedList: jest.fn(),
  subscribeToSharedList: jest.fn(),
}));

beforeEach(() => {
  (subscribeToSharedList as jest.Mock).mockReturnValue(() => {});
});

const PUSH = createTestPatternType({ slug: "push" });
const PASS = createTestPatternType({ slug: "pass" });
const WHIP = createTestPatternType({ slug: "whip" });

const insideTurn: IModifier = {
  id: "inside",
  name: "with Inside Turn",
  position: "amends",
  universal: false,
  videoRefs: [],
};

const sugarPush = createTestPattern(PUSH.id, {
  id: 1,
  name: "Sugar Push",
  counts: 6,
});
const leftSidePass = createTestPattern(PASS.id, {
  id: 2,
  name: "Left Side Pass",
  counts: 6,
  modifierRefs: [{ modifierId: "inside", videoRefs: [] }],
});
const basicWhip = createTestPattern(WHIP.id, {
  id: 3,
  name: "Basic Whip",
  counts: 8,
  // A variant with counts of its own: the step shows them.
  modifierRefs: [
    { modifierId: "inside", videoRefs: [], overrides: { counts: 10 } },
  ],
});
const PATTERNS = [sugarPush, leftSidePass, basicWhip];

const rallye: ISequence = {
  id: "rallye",
  name: "Rallye 2026",
  createdAt: 1,
  steps: [
    { kind: "figure", id: "a", patternId: 1 },
    { kind: "figure", id: "b", patternId: 3, modifierId: "inside" },
    { kind: "free", id: "c", text: "pose", counts: 2 },
  ],
};

async function renderSequences(
  listOverrides: Partial<IPatternList> = {},
  patterns: IPattern[] = PATTERNS,
) {
  const list = createTestPatternList({
    patternTypes: [PUSH, PASS, WHIP],
    modifiers: [insideTurn],
    ...listOverrides,
  });
  renderWithProviders(
    <AnonymizeJobsProvider>
      <PatternListManager />
    </AnonymizeJobsProvider>,
    { lists: [list], patterns: { [list.id]: patterns } },
  );
  if (patterns.length > 0) await screen.findByText(patterns[0].name);
  fireEvent.press(screen.getByRole("tab", { name: /^Sequences/ }));
  return list;
}

const storedList = async (listId: string): Promise<IPatternList> => {
  const lists: IPatternList[] = JSON.parse(
    (await AsyncStorage.getItem("@patternLists")) ?? "[]",
  );
  return lists.find((l) => l.id === listId)!;
};

/** The grips' pans of the newest render, one per step, top to bottom. */
function gripPans(count: number): MockGesture[] {
  const pans = peekGestures().filter(
    (g) => g.type === "pan" && g.config.minDistance === 0,
  );
  return pans.slice(-count);
}

describe("sequences on the List tab", () => {
  it("is the third segment, with a count, and says what a sequence is when there is none", async () => {
    await renderSequences();

    expect(screen.getByRole("tab", { name: "Figures (3)" })).toBeOnTheScreen();
    expect(screen.getByText("No sequences yet")).toBeOnTheScreen();
    expect(
      screen.getByText(
        "Figures in the order you dance them: a routine, a Rallye, a workshop combination.",
      ),
    ).toBeOnTheScreen();
  });

  it("lists each sequence with its steps and total counts", async () => {
    await renderSequences({ sequences: [rallye] });

    expect(
      screen.getByRole("tab", { name: "Sequences (1)" }),
    ).toBeOnTheScreen();
    expect(screen.getByText("Rallye 2026")).toBeOnTheScreen();
    // 6 + 10 (the variant's own counts) + 2.
    expect(screen.getByText("3 steps · 18 counts")).toBeOnTheScreen();
  });

  it("opens a sequence as a numbered list of its steps, with variant and counts", async () => {
    await renderSequences({ sequences: [rallye] });

    fireEvent.press(screen.getByText("Rallye 2026"));

    expect(screen.getByText("Basic Whip")).toBeOnTheScreen();
    expect(screen.getByText("with Inside Turn · 10 counts")).toBeOnTheScreen();
    expect(screen.getByText("Free step · 2 counts")).toBeOnTheScreen();
    expect(screen.getByText("pose")).toBeOnTheScreen();
    expect(screen.getByText("Edit")).toBeOnTheScreen();
  });

  it("closes the sheet with Close, and a new one's Cancel with nothing saved", async () => {
    const list = await renderSequences({ sequences: [rallye] });

    fireEvent.press(screen.getByText("Rallye 2026"));
    expect(screen.getByText("Basic Whip")).toBeOnTheScreen();
    fireEvent.press(screen.getByText("Close"));
    expect(screen.queryByText("Basic Whip")).toBeNull();

    fireEvent.press(screen.getByLabelText("New sequence"));
    fireEvent.changeText(screen.getByLabelText("Name"), "Not kept");
    fireEvent.press(screen.getByText("Cancel"));
    expect(screen.queryByText("Save sequence")).toBeNull();
    expect((await storedList(list.id)).sequences).toEqual([rallye]);
  });

  it("goes back from the form to the sequence on Cancel", async () => {
    await renderSequences({ sequences: [rallye] });

    fireEvent.press(screen.getByText("Rallye 2026"));
    fireEvent.press(screen.getByText("Edit"));
    fireEvent.changeText(screen.getByLabelText("Name"), "Renamed");
    fireEvent.press(screen.getByText("Cancel"));

    expect(screen.getByText("Edit")).toBeOnTheScreen();
    expect(screen.getAllByText("Rallye 2026").length).toBeGreaterThan(0);
  });

  it("creates a sequence from figures and a free step", async () => {
    const list = await renderSequences();

    fireEvent.press(screen.getByLabelText("New sequence"));
    fireEvent.changeText(screen.getByLabelText("Name"), "Workshop combo");

    fireEvent.press(screen.getByText("Add step"));
    fireEvent.changeText(screen.getByLabelText("Search by name..."), "sugr");
    fireEvent.press(screen.getByText("Sugar Push"));

    fireEvent.press(screen.getByText("Add step"));
    fireEvent.press(screen.getAllByText("Free step")[0]);
    // A free step opens with its text field; Save waits for the text.
    fireEvent.press(screen.getByText("Save sequence"));
    expect(screen.getByText("A free step needs its text.")).toBeOnTheScreen();
    fireEvent.changeText(screen.getByLabelText("Free step text"), "pose");
    fireEvent.changeText(screen.getByLabelText("Counts"), "2");

    expect(screen.getByText("2 steps · 8 counts")).toBeOnTheScreen();
    fireEvent.press(screen.getByText("Save sequence"));

    await waitFor(async () =>
      expect((await storedList(list.id)).sequences).toHaveLength(1),
    );
    const [saved] = (await storedList(list.id)).sequences!;
    expect(saved.name).toBe("Workshop combo");
    expect(saved.steps).toEqual([
      { kind: "figure", id: expect.any(String), patternId: 1 },
      { kind: "free", id: expect.any(String), text: "pose", counts: 2 },
    ]);
    // Saved, the sheet shows the sequence, with Edit.
    expect(await screen.findByText("Edit")).toBeOnTheScreen();
  });

  it("asks for a name before saving", async () => {
    await renderSequences();

    fireEvent.press(screen.getByLabelText("New sequence"));
    fireEvent.press(screen.getByText("Save sequence"));

    expect(
      screen.getByText("Give the sequence a name to save it."),
    ).toBeOnTheScreen();
  });

  it("offers a figure's variants under the new step, and counts the one picked", async () => {
    const list = await renderSequences();

    fireEvent.press(screen.getByLabelText("New sequence"));
    fireEvent.changeText(screen.getByLabelText("Name"), "Rallye 2026");
    fireEvent.press(screen.getByText("Add step"));
    fireEvent.press(screen.getByText("Basic Whip"));

    expect(screen.getByText("8 counts")).toBeOnTheScreen();
    fireEvent.press(screen.getByText("with Inside Turn"));
    expect(screen.getByText("with Inside Turn · 10 counts")).toBeOnTheScreen();

    fireEvent.press(screen.getByText("Save sequence"));
    await waitFor(async () =>
      expect((await storedList(list.id)).sequences?.[0].steps).toEqual([
        {
          kind: "figure",
          id: expect.any(String),
          patternId: 3,
          modifierId: "inside",
        },
      ]),
    );
  });

  it("shows the length in eights for a dance counted in eights", async () => {
    const salsa = [
      createTestPattern(PUSH.id, { id: 1, name: "Basic Step", counts: 8 }),
      createTestPattern(PUSH.id, { id: 2, name: "Cross Body Lead", counts: 8 }),
    ];
    await renderSequences(
      {
        dance: "salsa",
        sequences: [
          {
            ...rallye,
            steps: [
              { kind: "figure", id: "a", patternId: 1 },
              { kind: "figure", id: "b", patternId: 2 },
            ],
          },
        ],
      },
      salsa,
    );

    expect(screen.getByText("2 steps · 16 counts · 2 × 8")).toBeOnTheScreen();
  });

  it("reorders steps by dragging a grip", async () => {
    const list = await renderSequences({ sequences: [rallye] });

    fireEvent.press(screen.getByLabelText("Edit Rallye 2026"));
    [0, 1, 2].forEach((i) =>
      fireEvent(screen.getByTestId(`sequence-step-${i}`), "layout", {
        nativeEvent: { layout: { x: 0, y: i * 60, width: 300, height: 56 } },
      }),
    );

    // The first step, dragged below the second.
    const [first] = gripPans(3);
    act(() => {
      first.handlers.onBegin({});
      first.handlers.onStart({});
    });
    act(() => {
      first.handlers.onChange({ changeY: 70 });
    });
    act(() => {
      first.handlers.onEnd({});
      first.handlers.onFinalize({}, true);
    });
    fireEvent.press(screen.getByText("Save sequence"));

    await waitFor(async () =>
      expect(
        (await storedList(list.id)).sequences?.[0].steps.map((s) => s.id),
      ).toEqual(["b", "a", "c"]),
    );
  });

  it("moves a step with the grip's screen reader actions, duplicates and removes one", async () => {
    const list = await renderSequences({ sequences: [rallye] });

    fireEvent.press(screen.getByLabelText("Edit Rallye 2026"));
    fireEvent(
      screen.getByTestId("sequence-step-grip-2"),
      "accessibilityAction",
      {
        nativeEvent: { actionName: "moveUp" },
      },
    );
    fireEvent.press(screen.getByLabelText("Duplicate step 1"));
    fireEvent.press(screen.getByLabelText("Remove step 4"));
    fireEvent.press(screen.getByText("Save sequence"));

    await waitFor(async () => {
      const steps = (await storedList(list.id)).sequences![0].steps;
      expect(steps.map((s) => s.kind)).toEqual(["figure", "figure", "free"]);
      expect(steps[0].id).toBe("a");
      expect(steps[1]).toMatchObject({ kind: "figure", patternId: 1 });
      expect(steps[2].id).toBe("c");
    });
  });

  it("deletes a sequence after asking", async () => {
    const list = await renderSequences({ sequences: [rallye] });

    fireEvent.press(screen.getByLabelText("Delete Rallye 2026"));
    expect(
      screen.getByText(
        "Delete the sequence 'Rallye 2026'? Its figures stay on the list.",
      ),
    ).toBeOnTheScreen();
    fireEvent.press(screen.getByText("Delete"));

    await waitFor(async () =>
      expect(await storedList(list.id)).not.toHaveProperty("sequences"),
    );
  });

  it("names the sequences that use a figure before deleting it, and keeps the step as a free one", async () => {
    const list = await renderSequences({ sequences: [rallye] });

    fireEvent.press(screen.getByRole("tab", { name: /^Figures/ }));
    // Sorted by name: Basic Whip, Left Side Pass, Sugar Push.
    fireEvent.press(screen.getAllByLabelText("Delete Figure")[2]);
    expect(
      screen.getByText(
        "Delete 'Sugar Push'? It is used in Rallye 2026. Those steps become free steps with its name.",
      ),
    ).toBeOnTheScreen();
    fireEvent.press(screen.getByText("Delete"));

    await waitFor(async () =>
      expect((await storedList(list.id)).sequences![0].steps[0]).toEqual({
        kind: "free",
        id: "a",
        text: "Sugar Push",
        counts: 6,
      }),
    );
  });

  it("shows a read-only list's sequences without + or Edit", async () => {
    await renderSequences({ sequences: [rallye], readonly: true });

    expect(screen.getByText("Rallye 2026")).toBeOnTheScreen();
    expect(screen.queryByLabelText("New sequence")).toBeNull();
    expect(screen.queryByLabelText("Edit Rallye 2026")).toBeNull();
    expect(screen.queryByLabelText("Delete Rallye 2026")).toBeNull();

    fireEvent.press(screen.getByText("Rallye 2026"));
    const sheet = screen.getByText("Close").parent!.parent!;
    expect(within(sheet).queryByText("Edit")).toBeNull();
    expect(screen.getByText("Basic Whip")).toBeOnTheScreen();
  });
});
