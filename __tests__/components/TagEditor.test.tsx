import React from "react";
import PatternListTemplateModal from "@/src/pattern/list/PatternListTemplateModal";
import PatternFilterBottomSheet from "@/src/pattern/filter/components/PatternFilterBottomSheet";
import { IPatternList } from "@/src/pattern/types/IPatternList";
import { TagEdits } from "@/src/pattern/list/tagEdits";
import { LevelMoves, TypeMoves } from "@/src/pattern/list/typeMoves";
import {
  createTestPattern,
  createTestPatternList,
} from "@/utils/testFactories";
import {
  fireEvent,
  renderWithProviders,
  screen,
} from "@/utils/renderWithProviders";

// The Tags section of list settings: the list's tags with their figure counts, renamed,
// merged and deleted there, and handed to the host on Save.

const FIGURE_TAGS = [["Spin", "Basic"], ["basic", "Dip"], ["Spin"], []];

function renderSettings(
  overrides: Partial<
    React.ComponentProps<typeof PatternListTemplateModal>
  > = {},
) {
  const onSaveList = jest.fn<
    void,
    [IPatternList, TypeMoves, LevelMoves, TagEdits]
  >();
  renderWithProviders(
    <PatternListTemplateModal
      visible
      onClose={jest.fn()}
      editList={createTestPatternList({ name: "Salsa" })}
      figureTags={FIGURE_TAGS}
      onSaveList={onSaveList}
      {...overrides}
    />,
    { activeListId: null },
  );
  const save = () => {
    fireEvent.press(screen.getByText("Save"));
    const [, , , edits] = onSaveList.mock.calls.at(-1)!;
    return edits;
  };
  return { onSaveList, save };
}

const openTags = () => fireEvent.press(screen.getByText("Tags"));
const tagTitles = () =>
  screen
    .queryAllByLabelText(/^Rename /)
    .map((button) => button.props.accessibilityLabel.replace(/^Rename /, ""));

function rename(tag: string, to: string) {
  fireEvent.press(screen.getByLabelText(`Rename ${tag}`));
  fireEvent.changeText(screen.getByLabelText("Tag name"), to);
  fireEvent.press(screen.getByText("Rename"));
}

describe("the Tags section of list settings", () => {
  it("is folded when editing, saying how many tags the list has", () => {
    renderSettings();

    expect(screen.getByText("3 tags")).toBeOnTheScreen();
    expect(tagTitles()).toEqual([]);
  });

  it("is not there for a new list", () => {
    renderWithProviders(
      <PatternListTemplateModal
        visible
        onClose={jest.fn()}
        onCreateList={jest.fn()}
      />,
      { activeListId: null },
    );
    fireEvent.press(screen.getByText("Blank"));

    expect(screen.queryByText("Tags")).toBeNull();
  });

  it("opens on its own when asked to (the filter sheet's Manage)", () => {
    renderSettings({ openTags: true });

    expect(tagTitles()).toEqual(["Basic", "Dip", "Spin"]);
  });

  it("lists every tag by name with its figure count, ignoring case", () => {
    renderSettings();
    openTags();

    expect(tagTitles()).toEqual(["Basic", "Dip", "Spin"]);
    expect(screen.getAllByText("On 2 figures")).toHaveLength(2);
    expect(screen.getByText("On 1 figure")).toBeOnTheScreen();
  });

  it("says so when no figure has a tag", () => {
    renderSettings({ figureTags: [[], []] });
    expect(screen.getByText("No tags yet")).toBeOnTheScreen();
    openTags();

    expect(
      screen.getByText(/No figure on this list has a tag yet/),
    ).toBeOnTheScreen();
  });

  it("renames a tag, which is only a draft until Save", () => {
    const { onSaveList, save } = renderSettings();
    openTags();

    rename("Dip", "Drop");

    expect(tagTitles()).toEqual(["Basic", "Drop", "Spin"]);
    expect(onSaveList).not.toHaveBeenCalled();
    expect([...save()]).toEqual([["dip", "Drop"]]);
  });

  it("keeps the tag when the rename is cancelled, or the name left blank", () => {
    const { save } = renderSettings();
    openTags();

    fireEvent.press(screen.getByLabelText("Rename Dip"));
    fireEvent.changeText(screen.getByLabelText("Tag name"), "   ");
    fireEvent.press(screen.getByText("Rename"));
    expect(screen.getByText("Name cannot be empty")).toBeOnTheScreen();
    fireEvent.press(screen.getAllByText("Cancel").at(-1)!);

    expect(tagTitles()).toEqual(["Basic", "Dip", "Spin"]);
    expect(save().size).toBe(0);
  });

  it("asks before merging into a tag of the same name, ignoring case", () => {
    const { save } = renderSettings();
    openTags();

    rename("Spin", "BASIC");

    expect(screen.getByText("Merge Spin into Basic?")).toBeOnTheScreen();
    expect(tagTitles()).toEqual(["Basic", "Dip", "Spin"]);
    fireEvent.press(screen.getByText("Merge"));

    // The figure with both counts once.
    expect(tagTitles()).toEqual(["Basic", "Dip"]);
    expect(screen.getByText("On 3 figures")).toBeOnTheScreen();
    expect([...save()]).toEqual([["spin", "Basic"]]);
  });

  it("keeps both tags when the merge is cancelled", () => {
    const { save } = renderSettings();
    openTags();

    rename("Spin", "basic");
    fireEvent.press(screen.getAllByText("Cancel").at(-1)!);

    expect(tagTitles()).toEqual(["Basic", "Dip", "Spin"]);
    expect(save().size).toBe(0);
  });

  it("changes a tag's spelling without asking", () => {
    const { save } = renderSettings();
    openTags();

    rename("Basic", "BASIC");

    expect(screen.queryByText(/^Merge /)).toBeNull();
    expect(tagTitles()).toEqual(["BASIC", "Dip", "Spin"]);
    expect([...save()]).toEqual([["basic", "BASIC"]]);
  });

  it("deletes a tag after a question naming how many figures lose it", () => {
    const { save } = renderSettings();
    openTags();

    fireEvent.press(screen.getByLabelText("Delete Spin"));
    expect(
      screen.getByText("Spin will be removed from 2 figures."),
    ).toBeOnTheScreen();
    fireEvent.press(screen.getByText("Delete"));

    expect(tagTitles()).toEqual(["Basic", "Dip"]);
    expect([...save()]).toEqual([["spin", null]]);
  });

  it("names a single figure in the delete question, and keeps the tag on Cancel", () => {
    const { save } = renderSettings();
    openTags();

    fireEvent.press(screen.getByLabelText("Delete Dip"));
    expect(
      screen.getByText("Dip will be removed from 1 figure."),
    ).toBeOnTheScreen();
    fireEvent.press(screen.getAllByText("Cancel").at(-1)!);

    expect(tagTitles()).toEqual(["Basic", "Dip", "Spin"]);
    expect(save().size).toBe(0);
  });
});

describe("the filter sheet's Manage link", () => {
  const renderSheet = (onManageTags?: () => void) => {
    const onClose = jest.fn();
    renderWithProviders(
      <PatternFilterBottomSheet
        visible
        onClose={onClose}
        onApplyFilter={jest.fn()}
        currentFilter={{ name: "", types: [], levels: [], tags: [] }}
        allPatterns={[createTestPattern("push", { tags: ["Basic"] })]}
        onManageTags={onManageTags}
      />,
    );
    return onClose;
  };

  it("closes the sheet and opens the tags in list settings", () => {
    const onManageTags = jest.fn();
    const onClose = renderSheet(onManageTags);

    fireEvent.press(screen.getByText("Manage"));

    expect(onClose).toHaveBeenCalled();
    expect(onManageTags).toHaveBeenCalled();
  });

  it("is not there without a way to manage them (a read-only list)", () => {
    renderSheet();

    expect(screen.queryByText("Manage")).toBeNull();
  });
});
