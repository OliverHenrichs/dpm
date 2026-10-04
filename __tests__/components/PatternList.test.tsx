import React from "react";
import { FlatList } from "react-native";
import PatternList from "@/src/pattern/list/PatternList";
import {
  createTestPattern,
  createTestPatternType,
} from "@/utils/testFactories";
import {
  act,
  fireEvent,
  renderWithProviders,
  screen,
} from "@/utils/renderWithProviders";

const TYPE = createTestPatternType({ slug: "push" });

const noop = () => {};

function renderList(
  patterns = [
    createTestPattern(TYPE.id, { id: 1, name: "Sugar Push" }),
    createTestPattern(TYPE.id, { id: 2, name: "Left Side Pass" }),
    createTestPattern(TYPE.id, { id: 3, name: "Whip" }),
  ],
  overrides: Partial<React.ComponentProps<typeof PatternList>> = {},
) {
  return renderWithProviders(
    <PatternList
      patterns={patterns}
      patternTypes={[TYPE]}
      modifiers={[]}
      onSelect={noop}
      onDelete={noop}
      onAdd={noop}
      onEdit={noop}
      {...overrides}
    />,
  );
}

describe("PatternList", () => {
  it("renders every pattern", () => {
    renderList();

    expect(screen.getByText("Sugar Push")).toBeOnTheScreen();
    expect(screen.getByText("Left Side Pass")).toBeOnTheScreen();
    expect(screen.getByText("Whip")).toBeOnTheScreen();
  });

  it("sorts by name ascending by default, not by insertion order", () => {
    renderList();

    // Each row is named after its pattern; the hint is what they share.
    const renderedOrder = screen
      .getAllByHintText("Select Pattern")
      .map((row) => row.props.accessibilityLabel);

    expect(renderedOrder).toEqual(["Left Side Pass", "Sugar Push", "Whip"]);
  });

  it("shows the empty state when the list has no patterns", () => {
    renderList([]);

    expect(screen.getByText("No patterns available.")).toBeOnTheScreen();
  });

  it("shows the filtered empty state when a filter excludes everything", () => {
    renderList();

    fireEvent.press(screen.getByLabelText("Filter Patterns"));
    fireEvent.changeText(
      screen.getByPlaceholderText("Search by name..."),
      "zzzzz",
    );
    fireEvent.press(screen.getByText("Apply"));

    expect(
      screen.getByText("No patterns match the current filters."),
    ).toBeOnTheScreen();
  });

  it("expands a row into its details when selected", () => {
    const patterns = [
      createTestPattern(TYPE.id, {
        id: 1,
        name: "Sugar Push",
        description: "The basic",
      }),
    ];
    renderList(patterns, { selectedPattern: patterns[0] });

    expect(screen.getByText("The basic")).toBeOnTheScreen();
  });

  it("hides edit and delete affordances on a read-only list", () => {
    renderList(undefined, { isReadonly: true });

    expect(screen.queryByLabelText("Edit Pattern")).toBeNull();
    expect(screen.queryByLabelText("Delete Pattern")).toBeNull();
  });

  it("names the pattern in the delete confirmation", () => {
    renderList();

    // Rows are sorted by name, so the first delete button is "Left Side Pass".
    fireEvent.press(screen.getAllByLabelText("Delete Pattern")[0]);

    // Regression guard: the confirmation string takes a {{name}} placeholder,
    // and the caller has always passed one. Before this was wired up the copy
    // read "…delete this pattern?" and the name was silently dropped.
    expect(
      screen.getByText("Are you sure you want to delete 'Left Side Pass'?"),
    ).toBeOnTheScreen();
  });

  it("calls onDelete with the pattern id once confirmed", () => {
    const onDelete = jest.fn();
    renderList([createTestPattern(TYPE.id, { id: 7, name: "Sugar Push" })], {
      onDelete,
    });

    fireEvent.press(screen.getByLabelText("Delete Pattern"));
    fireEvent.press(screen.getByText("Delete"));

    expect(onDelete).toHaveBeenCalledWith(7);
  });
});

describe("PatternList rows and sections", () => {
  const WHIP_TYPE = createTestPatternType({ slug: "whip" });
  const sectioned = () =>
    renderList(
      [
        createTestPattern(TYPE.id, { id: 1, name: "Sugar Push", counts: 6 }),
        createTestPattern(WHIP_TYPE.id, {
          id: 2,
          name: "Basic Whip",
          counts: 8,
          level: undefined,
          videoRefs: [{ type: "url", value: "https://example.com/a" }],
        }),
        createTestPattern(WHIP_TYPE.id, { id: 3, name: "Basket Whip" }),
      ],
      { patternTypes: [WHIP_TYPE, TYPE] },
    );

  const sortBy = (label: string) => {
    fireEvent.press(screen.getByLabelText("Sort Patterns"));
    fireEvent.press(screen.getByText(label));
  };

  it("names type and level under a pattern, not its counts", () => {
    sectioned();

    expect(screen.getByText("push")).toBeOnTheScreen();
    // Basic Whip has no level, so only two rows name one.
    expect(screen.getAllByText("whip")).toHaveLength(2);
    expect(screen.getAllByText("· Beginner")).toHaveLength(2);
    expect(screen.queryByText(/counts/i)).toBeNull();
    expect(screen.getByLabelText("Videos: 1")).toBeOnTheScreen();
  });

  it("adds no headers when sorted by name", () => {
    sectioned();

    expect(screen.queryAllByRole("header")).toHaveLength(0);
  });

  it("heads each type in the list's own order, pinned while scrolling", () => {
    sectioned();
    sortBy("Type");

    const headers = screen.getAllByRole("header").map((h) => h.props.children);
    expect(headers).toHaveLength(2);
    expect(screen.getAllByText(/^(whip|push)$/)[0]).toHaveTextContent("whip");
    expect(screen.UNSAFE_getByType(FlatList).props.stickyHeaderIndices).toEqual(
      [0, 3],
    );
  });

  it("gathers patterns without a level under a last header", () => {
    sectioned();
    sortBy("Level");

    expect(screen.getByText("No level")).toBeOnTheScreen();
    expect(screen.UNSAFE_getByType(FlatList).props.stickyHeaderIndices).toEqual(
      [0, 3],
    );
  });

  it("heads each count when sorted by counts", () => {
    sectioned();
    sortBy("Counts");

    expect(screen.getByText("6 counts")).toBeOnTheScreen();
    expect(screen.getByText("8 counts")).toBeOnTheScreen();
  });
});

describe("PatternList revealing a pattern", () => {
  // Sorted by name: Left Side Pass, Sugar Push, Whip — Whip is row 2.
  const WHIP = { id: 3, at: 1 };
  let scrollToIndex: jest.SpyInstance;
  let scrollToOffset: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    scrollToIndex = jest
      .spyOn(FlatList.prototype, "scrollToIndex")
      .mockImplementation(() => {});
    scrollToOffset = jest
      .spyOn(FlatList.prototype, "scrollToOffset")
      .mockImplementation(() => {});
  });
  afterEach(() => {
    scrollToIndex.mockRestore();
    scrollToOffset.mockRestore();
    jest.useRealTimers();
  });

  it("scrolls to the row once the list has relaid out", () => {
    renderList(undefined, { reveal: WHIP });
    fireEvent(screen.UNSAFE_getByType(FlatList), "contentSizeChange", 0, 500);
    act(() => jest.runOnlyPendingTimers());

    expect(scrollToIndex).toHaveBeenCalledWith({ index: 2, viewPosition: 0 });
  });

  it("scrolls anyway when no relayout comes, and only once", () => {
    renderList(undefined, { reveal: WHIP });
    act(() => jest.advanceTimersByTime(300));
    // A late relayout finds nothing left to reveal.
    fireEvent(screen.UNSAFE_getByType(FlatList), "contentSizeChange", 0, 500);
    act(() => jest.runOnlyPendingTimers());

    expect(scrollToIndex).toHaveBeenCalledTimes(1);
  });

  it("does nothing for a pattern the list does not show", () => {
    renderList(undefined, { reveal: { id: 99, at: 1 } });
    act(() => jest.advanceTimersByTime(300));

    expect(scrollToIndex).not.toHaveBeenCalled();
  });

  it("estimates a jump when the row is not laid out yet", () => {
    renderList();
    fireEvent(screen.UNSAFE_getByType(FlatList), "scrollToIndexFailed", {
      index: 4,
      averageItemLength: 50,
      highestMeasuredFrameIndex: 1,
    });

    expect(scrollToOffset).toHaveBeenCalledWith({ offset: 200 });
  });
});

describe("PatternList sheets", () => {
  it("closes the add menu from its close button", () => {
    renderList(undefined, { onAddFromVideo: jest.fn() });
    fireEvent.press(screen.getByLabelText("Add Pattern"));
    expect(screen.getByText("From a video")).toBeOnTheScreen();

    fireEvent.press(screen.getByLabelText("Close"));
    expect(screen.queryByText("From a video")).toBeNull();
  });

  it("closes the sort sheet from its close button", () => {
    renderList();
    fireEvent.press(screen.getByLabelText("Sort Patterns"));
    expect(screen.getByText("Date Created")).toBeOnTheScreen();

    fireEvent.press(screen.getByLabelText("Close"));
    expect(screen.queryByText("Date Created")).toBeNull();
  });
});
