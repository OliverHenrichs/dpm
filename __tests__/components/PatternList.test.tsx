import React from "react";
import PatternList from "@/src/pattern/list/PatternList";
import {
  createTestPattern,
  createTestPatternType,
} from "@/utils/testFactories";
import {
  fireEvent,
  renderWithProviders,
  screen,
  within,
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

    const renderedOrder = screen
      .getAllByLabelText("Select Pattern")
      .map((row) => within(row).getByText(/.+/).props.children);

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
