import React, { act } from "react";
import { subscribeToSharedList } from "@/src/firebase/FirebaseListService";
import { AnonymizeJobsProvider } from "@/src/anonymize/jobs/AnonymizeJobsContext";
import PatternGraphScreen from "@/src/pattern/graph/PatternGraphScreen";
import PatternListManager from "@/src/pattern/list/PatternListManager";
import MemoPatternNode, {
  SEQUENCE_DIM_OPACITY,
} from "@/src/pattern/graph/PatternNode";
import NetworkGraphSvg from "@/src/pattern/graph/GraphSvg";
import SequenceLayer, {
  SEQUENCE_DASH,
} from "@/src/pattern/graph/render/SequenceLayer";
import PatternDetails from "@/src/pattern/graph/PatternDetails";
import { buildGraphModel } from "@/src/pattern/graph/model/GraphModel";
import { sequenceOverlay } from "@/src/pattern/graph/model/sequenceOverlay";
import { LayoutPosition } from "@/src/pattern/graph/utils/GraphUtils";
import { IPatternList, ISequence } from "@/src/pattern/types/IPatternList";
import { seedAsyncStorage } from "@/__mocks__/@react-native-async-storage/async-storage";
import { render } from "@testing-library/react-native";
import { G, Path } from "react-native-svg";
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
  within,
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
const WHIP = createTestPatternType({ slug: "whip" });
const sugarPush = createTestPattern(PUSH.id, {
  id: 1,
  name: "Sugar Push",
  counts: 6,
});
const sugarTuck = createTestPattern(PUSH.id, {
  id: 2,
  name: "Sugar Tuck",
  counts: 6,
  prerequisites: [1],
});
const basicWhip = createTestPattern(WHIP.id, {
  id: 3,
  name: "Basic Whip",
  counts: 8,
});
const PATTERNS = [sugarPush, sugarTuck, basicWhip];

const rallye: ISequence = {
  id: "rallye",
  name: "Rallye 2026",
  createdAt: 1,
  steps: [
    { kind: "figure", id: "a", patternId: 1 },
    { kind: "free", id: "b", text: "pose" },
    { kind: "figure", id: "c", patternId: 3 },
  ],
};
const combo: ISequence = {
  id: "combo",
  name: "Workshop combo",
  createdAt: 2,
  steps: [{ kind: "figure", id: "d", patternId: 1 }],
};

/** The box component inside `React.memo`, which the type queries cannot see through. */
const PatternNode = (MemoPatternNode as unknown as { type: React.FC }).type;

async function renderMap(overrides: Partial<IPatternList> = {}) {
  const list = createTestPatternList({
    patternTypes: [PUSH, WHIP],
    sequences: [rallye, combo],
    ...overrides,
  });
  renderWithProviders(<PatternGraphScreen />, {
    lists: [list],
    patterns: { [list.id]: PATTERNS },
  });
  await waitFor(() =>
    expect(screen.UNSAFE_getAllByType(PatternNode)).toHaveLength(3),
  );
  return list;
}

const showSequence = async (name: string) => {
  fireEvent.press(screen.getByLabelText("Filter Figures"));
  const section = await screen.findByTestId("sequence-map-filter");
  fireEvent.press(within(section).getByText(name));
};

/** Which boxes are drawn back, by figure name. */
const dimmed = () =>
  screen
    .UNSAFE_getAllByType(PatternNode)
    .filter((n) => n.props.dimmed)
    .map((n) => n.props.node.pattern.name);

describe("Show sequence on the Map", () => {
  it("offers the list's sequences in the filter sheet, and None", async () => {
    await renderMap();

    fireEvent.press(screen.getByLabelText("Filter Figures"));
    const section = await screen.findByTestId("sequence-map-filter");

    expect(within(section).getByText("Show sequence")).toBeOnTheScreen();
    expect(within(section).getByText("None")).toBeOnTheScreen();
    expect(within(section).getByText("Rallye 2026")).toBeOnTheScreen();
    expect(within(section).getByText("Workshop combo")).toBeOnTheScreen();
  });

  it("is not offered on a list without sequences", async () => {
    await renderMap({ sequences: undefined });

    fireEvent.press(screen.getByLabelText("Filter Figures"));
    await screen.findByPlaceholderText("Search by name...");

    expect(screen.queryByTestId("sequence-map-filter")).toBeNull();
  });

  it("lays the sequence over the graph, dims the other figures and names it above", async () => {
    await renderMap();
    expect(screen.UNSAFE_queryAllByType(SequenceLayer)).toHaveLength(0);

    await showSequence("Rallye 2026");

    expect(await screen.findByText("Sequence: Rallye 2026")).toBeOnTheScreen();
    const [layer] = screen.UNSAFE_getAllByType(SequenceLayer);
    expect(layer.props.overlay.hops).toEqual([{ from: 1, to: 3 }]);
    expect(layer.props.overlay.numbers.get(3)).toEqual([3]);
    // Every figure stays on the Map; only the one outside the sequence goes back.
    expect(screen.UNSAFE_getAllByType(PatternNode)).toHaveLength(3);
    expect(dimmed()).toEqual(["Sugar Tuck"]);
  });

  it("hides it again from the line above the Map, or with None", async () => {
    await renderMap();
    await showSequence("Rallye 2026");
    await screen.findByText("Sequence: Rallye 2026");

    fireEvent.press(screen.getByLabelText("Hide sequence"));
    expect(screen.queryByText("Sequence: Rallye 2026")).toBeNull();
    expect(screen.UNSAFE_queryAllByType(SequenceLayer)).toHaveLength(0);
    expect(dimmed()).toEqual([]);

    await showSequence("Workshop combo");
    await screen.findByText("Sequence: Workshop combo");
    fireEvent.press(
      within(screen.getByTestId("sequence-map-filter")).getByText("None"),
    );
    expect(screen.queryByText("Sequence: Workshop combo")).toBeNull();
  });

  it("says how many of its figures are drawn when the filter hides some", async () => {
    await renderMap();
    await showSequence("Rallye 2026");
    fireEvent.press(await screen.findByLabelText("Matches only"));
    fireEvent.changeText(
      screen.getByPlaceholderText("Search by name..."),
      "Sugar",
    );
    fireEvent.press(screen.getByText("Apply"));

    expect(
      await screen.findByText("Sequence: Rallye 2026 · 1 of 2 figures shown"),
    ).toBeOnTheScreen();
  });

  it("opens the sequence from the line above the Map", async () => {
    await renderMap();
    await showSequence("Rallye 2026");
    fireEvent.press(screen.getByText("Apply"));

    fireEvent.press(await screen.findByText("Sequence: Rallye 2026"));

    expect(await screen.findByText("pose")).toBeOnTheScreen();
    expect(screen.getByText("Close")).toBeOnTheScreen();
  });

  it("opens a sequence from a figure's details, and comes back to them", async () => {
    await renderMap();
    const box = screen
      .UNSAFE_getAllByType(PatternNode)
      .find((n) => n.props.node.pattern.name === "Sugar Push")!;
    await act(async () => box.props.onPress(box.props.node.pattern));
    const inSequences = await screen.findByTestId("details-in-sequences");
    expect(within(inSequences).getByText("Rallye 2026")).toBeOnTheScreen();
    expect(within(inSequences).getByText("Workshop combo")).toBeOnTheScreen();

    fireEvent.press(screen.getByLabelText("Open sequence Rallye 2026"));

    expect(await screen.findByText("pose")).toBeOnTheScreen();
    expect(screen.queryByLabelText("Dismiss details")).toBeNull();
    fireEvent.press(screen.getByText("Close"));
    expect(await screen.findByLabelText("Dismiss details")).toBeOnTheScreen();
  });
});

describe("the sequence layer", () => {
  const model = buildGraphModel(PATTERNS, [PUSH, WHIP]);
  const positions = new Map<number, LayoutPosition>([
    [1, { x: 100, y: 100 }],
    [2, { x: 400, y: 100 }],
    [3, { x: 100, y: 400 }],
  ]);
  const overlay = sequenceOverlay(rallye, new Set([1, 2, 3]));

  it("draws dashed arrows over the graph and puts the prerequisite edges back", () => {
    render(
      <NetworkGraphSvg
        svgWidth={800}
        svgHeight={800}
        model={model}
        positions={positions}
        onNodeTap={jest.fn()}
        sequence={overlay}
      />,
    );

    const dashed = screen
      .UNSAFE_getAllByType(Path)
      .filter((p) => p.props.strokeDasharray === SEQUENCE_DASH);
    expect(dashed).toHaveLength(1);
    // The edges' group sits back; the nodes outside the sequence are drawn back.
    expect(
      screen.UNSAFE_getAllByType(G).some((g) => g.props.opacity === 0.3),
    ).toBe(true);
    expect(dimmed()).toEqual(["Sugar Tuck"]);
    expect(
      screen
        .UNSAFE_getAllByType(G)
        .filter((g) => g.props.opacity === SEQUENCE_DIM_OPACITY).length,
    ).toBeGreaterThan(0);
  });

  it("leaves the dragged node's arrows and badge out until the drop", () => {
    render(
      <SequenceLayer overlay={overlay} positions={positions} draggingId={3} />,
    );

    expect(screen.queryAllByTestId("sequence-hop")).toHaveLength(0);
    expect(screen.queryAllByTestId("sequence-badge")).toHaveLength(1);
  });

  it("draws nothing extra without a sequence", () => {
    render(
      <NetworkGraphSvg
        svgWidth={800}
        svgHeight={800}
        model={model}
        positions={positions}
        onNodeTap={jest.fn()}
      />,
    );

    expect(screen.UNSAFE_queryAllByType(SequenceLayer)).toHaveLength(0);
    expect(dimmed()).toEqual([]);
  });
});

describe("In: … under a figure's details", () => {
  const renderDetails = (onOpenSequence?: (id: string) => void) =>
    renderWithProviders(
      <PatternDetails
        selectedPattern={sugarPush}
        patterns={PATTERNS}
        patternTypes={[PUSH, WHIP]}
        sequences={[rallye, combo]}
        onOpenSequence={onOpenSequence}
      />,
    );

  it("names the sequences the figure is danced in, each opening it", () => {
    const onOpen = jest.fn();
    renderDetails(onOpen);

    expect(screen.getByText("In:")).toBeOnTheScreen();
    fireEvent.press(screen.getByLabelText("Open sequence Workshop combo"));

    expect(onOpen).toHaveBeenCalledWith("combo");
  });

  it("names them without links when nothing opens them", () => {
    renderDetails();

    expect(screen.getByText("Rallye 2026")).toBeOnTheScreen();
    expect(screen.queryByLabelText("Open sequence Rallye 2026")).toBeNull();
  });

  it("says nothing for a figure in no sequence", () => {
    renderWithProviders(
      <PatternDetails
        selectedPattern={sugarTuck}
        patterns={PATTERNS}
        sequences={[rallye, combo]}
      />,
    );

    expect(screen.queryByTestId("details-in-sequences")).toBeNull();
  });
});

describe("on the List tab", () => {
  async function renderList() {
    const list = createTestPatternList({
      patternTypes: [PUSH, WHIP],
      sequences: [rallye, combo],
    });
    renderWithProviders(
      <AnonymizeJobsProvider>
        <PatternListManager />
      </AnonymizeJobsProvider>,
      { lists: [list], patterns: { [list.id]: PATTERNS } },
    );
    await screen.findByText("Sugar Push");
  }

  it("opens a sequence from an opened figure's In: …", async () => {
    await renderList();

    fireEvent.press(screen.getByText("Sugar Push"));
    fireEvent.press(await screen.findByLabelText("Open sequence Rallye 2026"));

    expect(await screen.findByText("pose")).toBeOnTheScreen();
    expect(screen.getByText("Edit")).toBeOnTheScreen();
  });

  it("offers first what followed the last step in the other sequences", async () => {
    await renderList();
    fireEvent.press(screen.getByRole("tab", { name: /^Sequences/ }));
    fireEvent.press(screen.getByLabelText("New sequence"));

    // Nothing to follow on from yet.
    fireEvent.press(screen.getByText("Add step"));
    expect(screen.queryByTestId("step-picker-hints")).toBeNull();
    fireEvent.press(screen.getByText("Sugar Push"));

    // In Rallye 2026, Basic Whip came after Sugar Push (past the free step).
    fireEvent.press(screen.getByText("Add step"));
    const hints = screen.getByTestId("step-picker-hints");
    expect(within(hints).getByText("Often next")).toBeOnTheScreen();
    expect(within(hints).getByText("Basic Whip")).toBeOnTheScreen();
    expect(within(hints).queryByText("Sugar Tuck")).toBeNull();

    // A search shows only the matches.
    fireEvent.changeText(screen.getByLabelText("Search by name..."), "tuck");
    expect(screen.queryByTestId("step-picker-hints")).toBeNull();
  });
});
