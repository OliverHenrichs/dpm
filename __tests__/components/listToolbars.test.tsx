import ModifierList from "@/src/pattern/list/ModifierList";
import ListSharingBand from "@/src/pattern/list/ListSharingBand";
import { IModifier } from "@/src/pattern/types/IPatternList";
import {
  fireEvent,
  renderWithProviders,
  screen,
} from "@/utils/renderWithProviders";

const modifier = (
  name: string,
  position: IModifier["position"],
  universal = false,
): IModifier => ({ id: name, name, position, universal, videoRefs: [] });

describe("the Modifiers toolbar", () => {
  function renderList(onEditList?: () => void, isReadonly = false) {
    renderWithProviders(
      <ModifierList
        modifiers={[
          modifier("with Duck", "postfix"),
          modifier("Hesitation", "amends", true),
          modifier("with Inside Turn", "prefix"),
        ]}
        patterns={[]}
        isReadonly={isReadonly}
        onAdd={jest.fn()}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
        onEditList={onEditList}
      />,
      { activeListId: null },
    );
  }

  it("shows the sort in force on its chip", () => {
    renderList();

    expect(screen.getByLabelText("Sort Modifiers")).toHaveTextContent(
      /Date Created/,
    );
  });

  it("opens the list's settings beside its +", () => {
    const onEditList = jest.fn();
    renderList(onEditList);

    fireEvent.press(screen.getByLabelText("Edit the list and its types"));

    expect(onEditList).toHaveBeenCalled();
    expect(screen.getByLabelText("Add Modifier")).toBeOnTheScreen();
  });

  it("shows a lock instead of settings and + on a read-only list", () => {
    renderList(jest.fn(), true);

    expect(screen.getByLabelText("Read-only list")).toBeOnTheScreen();
    expect(screen.queryByLabelText("Add Modifier")).not.toBeOnTheScreen();
    expect(
      screen.queryByLabelText("Edit the list and its types"),
    ).not.toBeOnTheScreen();
  });

  it("says when no modifier matches the filter", () => {
    renderList();

    fireEvent.press(screen.getByLabelText("Filter Modifiers"));
    fireEvent.changeText(
      screen.getByPlaceholderText("Search by name..."),
      "telemark",
    );
    fireEvent.press(screen.getByText("Apply"));

    expect(
      screen.getByText("No modifiers match the current filters."),
    ).toBeOnTheScreen();
  });

  it("sorts by position under a header for each", () => {
    renderList();

    fireEvent.press(screen.getByLabelText("Sort Modifiers"));
    fireEvent.press(screen.getByText("Position"));

    expect(screen.getByRole("header", { name: /Entry/ })).toBeOnTheScreen();
    expect(screen.getByRole("header", { name: /During/ })).toBeOnTheScreen();
    expect(screen.getByRole("header", { name: /Exit/ })).toBeOnTheScreen();
  });

  it("filters by kind, and counts the criterion on the chip", () => {
    renderList();

    fireEvent.press(screen.getByLabelText("Filter Modifiers"));
    fireEvent.press(screen.getByText("Universal"));
    fireEvent.press(screen.getByText("Apply"));

    expect(screen.getByText("Hesitation")).toBeOnTheScreen();
    expect(screen.queryByText("with Duck")).not.toBeOnTheScreen();
    expect(screen.getByText("Filter · 1")).toBeOnTheScreen();
  });
});

describe("ListSharingBand", () => {
  it("shows the owner what is waiting, in words", () => {
    const onMembers = jest.fn();
    renderWithProviders(
      <ListSharingBand
        role="owner"
        members={{ waiting: 3, onPress: onMembers }}
        suggestions={{ count: 0, onPress: jest.fn() }}
      />,
      { activeListId: null },
    );

    expect(screen.getByText("Published")).toBeOnTheScreen();
    expect(screen.getByText("Asking to join")).toBeOnTheScreen();
    expect(screen.getByText("3")).toBeOnTheScreen();
    expect(screen.getByText("Suggestions")).toBeOnTheScreen();

    fireEvent.press(
      screen.getByLabelText("Members and requests to join (3 waiting)"),
    );
    expect(onMembers).toHaveBeenCalled();
  });

  it("offers a follower to suggest a figure", () => {
    renderWithProviders(
      <ListSharingBand role="follower" onSuggest={jest.fn()} />,
      { activeListId: null },
    );

    expect(screen.getByText("Following")).toBeOnTheScreen();
    expect(screen.getByText("Suggest a figure")).toBeOnTheScreen();
  });

  it("is not there without anything to do", () => {
    renderWithProviders(<ListSharingBand role="owner" />, {
      activeListId: null,
    });

    expect(screen.queryByText("Published")).not.toBeOnTheScreen();
  });
});
