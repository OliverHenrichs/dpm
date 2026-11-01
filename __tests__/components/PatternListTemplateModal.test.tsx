import React from "react";
import { StyleSheet } from "react-native";
import type { ReactTestInstance } from "react-test-renderer";
import PatternListTemplateModal from "@/src/pattern/list/PatternListTemplateModal";
import { IPatternList, NewPattern } from "@/src/pattern/types/IPatternList";
import { createTestPatternList } from "@/utils/testFactories";
import { createPatternType } from "@/src/pattern/data/DefaultPatternLists";
import { normalizeSlug } from "@/src/pattern/types/PatternType";
import {
  fireEvent,
  renderWithProviders,
  screen,
} from "@/utils/renderWithProviders";

type Created = { list: IPatternList; patterns: NewPattern[] };

function renderModal(
  overrides: Partial<
    React.ComponentProps<typeof PatternListTemplateModal>
  > = {},
  folded = false,
) {
  const onCreateList = jest.fn<void, [IPatternList, NewPattern[]]>();
  const onSaveList = jest.fn<
    void,
    [IPatternList, Record<string, string>, Record<string, string>]
  >();
  const onClose = jest.fn();
  renderWithProviders(
    <PatternListTemplateModal
      visible
      onClose={onClose}
      onCreateList={onCreateList}
      onSaveList={onSaveList}
      {...overrides}
    />,
    { activeListId: null },
  );
  // Editing starts with the sections closed; most tests are about what is inside them.
  if (overrides.editList && !folded) {
    ["Dance", "Figure Types", "Levels"].forEach((title) =>
      fireEvent.press(screen.getByText(title)),
    );
  }
  const created = (): Created => ({
    list: onCreateList.mock.calls.at(-1)![0],
    patterns: onCreateList.mock.calls.at(-1)![1],
  });
  return { onCreateList, onSaveList, onClose, created };
}

/** Walk from the template picker into the configure step. */
function pickTemplate(name: string) {
  fireEvent.press(screen.getByText(name));
}

const nameInput = () => screen.getByLabelText("List Name");
/** Uses queryAll: a blank list legitimately starts with no types at all. */
const typeInputs = () => screen.queryAllByPlaceholderText("Type name");
const levelInputs = () => screen.queryAllByPlaceholderText("Level name");
const levelNames = () => levelInputs().map((input) => input.props.value);
const removeLevelButtons = () => screen.getAllByLabelText(/^Remove level: /);

/**
 * The row <View> a type is edited in. Nothing on it is queryable by text or
 * label, so walk up from its slug input: the row is the first ancestor with a
 * zIndex, which is exactly the property that orders it against the rows below.
 */
function typeRow(index: number): ReactTestInstance {
  let node: ReactTestInstance | null = typeInputs()[index];
  while (node && StyleSheet.flatten(node.props.style)?.zIndex === undefined) {
    node = node.parent;
  }
  if (!node) throw new Error(`no type row above slug input ${index}`);
  return node;
}

/** Each type's remove button, in row order. */
const removeTypeButtons = () => screen.getAllByLabelText(/^Remove type:/);

/** The starter patterns that are ticked. */
const ticked = () =>
  screen
    .queryAllByRole("checkbox")
    .filter((box) => box.props.accessibilityState?.checked);

/** The colour dot is the first child of its row, the open swatch grid the last. */
const colorDot = (row: ReactTestInstance) =>
  row.children[0] as ReactTestInstance;

/** The swatch buttons of the open grid, in palette order. */
function swatches(row: ReactTestInstance): ReactTestInstance[] {
  // Breadth-first to the grid itself: every View shows up twice in the tree,
  // as the component and as the host element, and only the host one holds the
  // swatches as its children.
  const queue: (ReactTestInstance | string)[] = [row];
  while (queue.length) {
    const node = queue.shift()!;
    if (typeof node === "string") continue;
    if (
      typeof node.type === "string" &&
      StyleSheet.flatten(node.props.style)?.flexWrap === "wrap"
    ) {
      return node.children.filter(
        (child): child is ReactTestInstance => typeof child !== "string",
      );
    }
    queue.push(...node.children);
  }
  throw new Error("the swatch grid is not open");
}

describe("PatternListTemplateModal", () => {
  describe("choosing a starting point", () => {
    it("offers every template", () => {
      renderModal();

      expect(screen.getByText("Choose a Starting Point")).toBeOnTheScreen();
      for (const name of [
        "Blank",
        "West Coast Swing",
        "Salsa",
        "Bachata",
        "Argentine Tango",
        "Brazilian Zouk",
        "Lindy Hop",
      ]) {
        expect(screen.getByText(name)).toBeOnTheScreen();
      }
    });

    it("closes without creating anything", () => {
      const { onClose, onCreateList } = renderModal();

      fireEvent.press(screen.getByText("Cancel"));

      expect(onClose).toHaveBeenCalled();
      expect(onCreateList).not.toHaveBeenCalled();
    });

    it("moves to the configure step once one is picked", () => {
      renderModal();

      pickTemplate("Salsa");

      expect(screen.getByText("Configure Your List")).toBeOnTheScreen();
    });

    it("can be stepped back out of", () => {
      renderModal();

      pickTemplate("Salsa");
      fireEvent.press(screen.getByText("Back"));

      expect(screen.getByText("Choose a Starting Point")).toBeOnTheScreen();
    });
  });

  describe("seeding from the template", () => {
    it("pre-fills the name from the chosen dance", () => {
      renderModal();

      pickTemplate("West Coast Swing");

      expect(nameInput().props.value).toBe("West Coast Swing");
    });

    it("leaves the name empty for a blank list", () => {
      renderModal();

      pickTemplate("Blank");

      expect(nameInput().props.value).toBe("");
    });

    it("brings the template's pattern types along", () => {
      renderModal();

      pickTemplate("West Coast Swing");

      expect(typeInputs().length).toBeGreaterThan(0);
      expect(typeInputs().every((i) => typeof i.props.value === "string")).toBe(
        true,
      );
    });

    it("offers the template's starter patterns, all ticked", () => {
      renderModal();

      pickTemplate("West Coast Swing");

      expect(screen.getByText("Starting Figures")).toBeOnTheScreen();
      expect(ticked().length).toBeGreaterThan(0);
    });

    it("offers no starter patterns for a blank list", () => {
      renderModal();

      pickTemplate("Blank");

      expect(screen.queryByText("Starting Figures")).toBeNull();
    });
  });

  describe("creating", () => {
    it("hands over the list and its starter patterns", () => {
      const { onCreateList, created } = renderModal();

      pickTemplate("West Coast Swing");
      fireEvent.press(screen.getByText("Create"));

      expect(onCreateList).toHaveBeenCalled();
      expect(created().list.name).toBe("West Coast Swing");
      expect(created().patterns.length).toBeGreaterThan(0);
    });

    it("gives every starter pattern a type that exists on the list", () => {
      const { created } = renderModal();

      pickTemplate("Salsa");
      fireEvent.press(screen.getByText("Create"));

      const typeIds = new Set(created().list.patternTypes.map((t) => t.id));
      for (const pattern of created().patterns) {
        expect(typeIds.has(pattern.typeId)).toBe(true);
      }
    });

    it("leaves out a starter pattern that was unticked", () => {
      const { created } = renderModal();

      pickTemplate("West Coast Swing");
      const before = ticked().length;
      fireEvent.press(ticked()[0]);
      fireEvent.press(screen.getByText("Create"));

      expect(ticked()).toHaveLength(before - 1);
      expect(created().patterns).toHaveLength(before - 1);
    });

    it("trims the name", () => {
      const { created } = renderModal();

      pickTemplate("Blank");
      fireEvent.changeText(nameInput(), "  Salsa  ");
      fireEvent.press(screen.getByText("Create"));

      expect(created().list.name).toBe("Salsa");
    });

    it("normalises type names", () => {
      const { created } = renderModal();

      pickTemplate("Blank");
      fireEvent.changeText(nameInput(), "My List");
      fireEvent.press(screen.getByText(/Add type/));
      fireEvent.changeText(typeInputs()[0], "  Sugar Push  ");
      fireEvent.press(screen.getByText("Create"));

      expect(created().list.patternTypes[0].slug).toBe(
        normalizeSlug("  Sugar Push  "),
      );
    });

    it("closes afterwards", () => {
      const { onClose } = renderModal();

      pickTemplate("Salsa");
      fireEvent.press(screen.getByText("Create"));

      expect(onClose).toHaveBeenCalled();
    });
  });

  describe("validation", () => {
    it("will not create a list with no name", () => {
      const { onCreateList } = renderModal();

      pickTemplate("Blank");
      fireEvent.press(screen.getByText("Create"));

      expect(onCreateList).not.toHaveBeenCalled();
    });

    it("will not create one with a blank type name", () => {
      const { onCreateList } = renderModal();

      pickTemplate("Blank");
      fireEvent.changeText(nameInput(), "My List");
      fireEvent.press(screen.getByText(/Add type/));
      fireEvent.press(screen.getByText("Create"));

      expect(screen.getByText(/Name cannot be empty/)).toBeOnTheScreen();
      expect(onCreateList).not.toHaveBeenCalled();
    });

    it("will not create one with two types of the same name", () => {
      const { onCreateList } = renderModal();

      pickTemplate("Blank");
      fireEvent.changeText(nameInput(), "My List");
      fireEvent.press(screen.getByText(/Add type/));
      fireEvent.press(screen.getByText(/Add type/));
      fireEvent.changeText(typeInputs()[0], "push");
      fireEvent.changeText(typeInputs()[1], "push");
      fireEvent.press(screen.getByText("Create"));

      expect(screen.getAllByText(/Name already used/).length).toBeGreaterThan(
        0,
      );
      expect(onCreateList).not.toHaveBeenCalled();
    });

    it("treats names differing only by case as the same", () => {
      const { onCreateList } = renderModal();

      pickTemplate("Blank");
      fireEvent.changeText(nameInput(), "My List");
      fireEvent.press(screen.getByText(/Add type/));
      fireEvent.press(screen.getByText(/Add type/));
      fireEvent.changeText(typeInputs()[0], "Push");
      fireEvent.changeText(typeInputs()[1], "push");
      fireEvent.press(screen.getByText("Create"));

      expect(onCreateList).not.toHaveBeenCalled();
    });

    it("lets creation through once the clash is resolved", () => {
      const { onCreateList } = renderModal();

      pickTemplate("Blank");
      fireEvent.changeText(nameInput(), "My List");
      fireEvent.press(screen.getByText(/Add type/));
      fireEvent.press(screen.getByText(/Add type/));
      fireEvent.changeText(typeInputs()[0], "push");
      fireEvent.changeText(typeInputs()[1], "push");
      fireEvent.changeText(typeInputs()[1], "pass");
      fireEvent.press(screen.getByText("Create"));

      expect(onCreateList).toHaveBeenCalled();
    });
  });

  describe("editing the pattern types", () => {
    it("adds one", () => {
      renderModal();

      pickTemplate("Blank");
      const before = typeInputs().length;
      fireEvent.press(screen.getByText(/Add type/));

      expect(typeInputs()).toHaveLength(before + 1);
    });

    it("removes one", () => {
      renderModal();

      pickTemplate("West Coast Swing");
      const before = typeInputs().length;
      fireEvent.press(removeTypeButtons()[0]);

      expect(typeInputs()).toHaveLength(before - 1);
    });

    it("unticks starter patterns whose type was removed", () => {
      // Otherwise a pattern would be created against a type that is not there.
      renderModal();

      pickTemplate("West Coast Swing");
      const before = ticked().length;
      fireEvent.press(removeTypeButtons()[0]);

      expect(ticked().length).toBeLessThan(before);
    });

    it("never creates a pattern for a type that was removed", () => {
      const { created } = renderModal();

      pickTemplate("West Coast Swing");
      fireEvent.press(removeTypeButtons()[0]);
      fireEvent.press(screen.getByText("Create"));

      const typeIds = new Set(created().list.patternTypes.map((t) => t.id));
      for (const pattern of created().patterns) {
        expect(typeIds.has(pattern.typeId)).toBe(true);
      }
    });
  });

  describe("picking a type colour", () => {
    it("names the dot after its type, and each swatch by position", () => {
      renderModal();
      pickTemplate("West Coast Swing");

      const dot = colorDot(typeRow(0));
      expect(dot.props.accessibilityLabel).toMatch(/^Colour of /);
      fireEvent.press(dot);

      const grid = swatches(typeRow(0));
      expect(grid[0].props.accessibilityLabel).toBe(
        `Colour 1 of ${grid.length}`,
      );
      expect(
        grid.filter((swatch) => swatch.props.accessibilityState?.checked),
      ).toHaveLength(1);
    });

    it("opens the swatches on the dot and closes them again", () => {
      renderModal();

      pickTemplate("West Coast Swing");
      const closed = typeRow(0).children.length;
      fireEvent.press(colorDot(typeRow(0)));

      expect(typeRow(0).children.length).toBe(closed + 1);

      fireEvent.press(colorDot(typeRow(0)));

      expect(typeRow(0).children.length).toBe(closed);
    });

    it("lifts its row above the rows underneath while they are open", () => {
      // The swatch grid hangs down over the next rows. They are later siblings
      // of the same zIndex, so without this they paint over it and the grid
      // disappears behind their type name inputs.
      renderModal();

      pickTemplate("West Coast Swing");
      const resting = StyleSheet.flatten(typeRow(1).props.style).zIndex;
      expect(StyleSheet.flatten(typeRow(0).props.style).zIndex).toBe(resting);

      fireEvent.press(colorDot(typeRow(0)));

      const open = StyleSheet.flatten(typeRow(0).props.style);
      expect(open.zIndex).toBeGreaterThan(resting);
      // Android orders siblings by elevation, not by zIndex.
      expect(open.elevation).toBeGreaterThan(0);
    });

    it("puts the swatches in front of its own slug input too", () => {
      renderModal();

      pickTemplate("West Coast Swing");
      fireEvent.press(colorDot(typeRow(0)));

      const row = typeRow(0);
      const grid = row.children.at(-1) as ReactTestInstance;
      const inputIndex = row.children.findIndex(
        (child) =>
          typeof child !== "string" && child.props.placeholder === "Type name",
      );
      expect(StyleSheet.flatten(grid.props.style).zIndex).toBeGreaterThan(
        StyleSheet.flatten(typeInputs()[0].props.style).zIndex ?? 0,
      );
      // ...and it comes after the input, so paint order agrees with the zIndex
      // on any platform that ignores it.
      expect(row.children.length - 1).toBeGreaterThan(inputIndex);
    });

    it("applies the picked colour to the type", () => {
      const { created } = renderModal();

      pickTemplate("West Coast Swing");
      const before = StyleSheet.flatten(
        colorDot(typeRow(0)).props.style,
      ).backgroundColor;
      fireEvent.press(colorDot(typeRow(0)));
      const swatch = swatches(typeRow(0)).at(-1)!;
      const picked = StyleSheet.flatten(swatch.props.style).backgroundColor;
      fireEvent.press(swatch);
      fireEvent.press(screen.getByText("Create"));

      expect(picked).not.toBe(before);
      expect(created().list.patternTypes[0].color).toBe(picked);
      // Choosing closes the grid again.
      expect(typeRow(0).children).toHaveLength(3);
    });
  });

  describe("dance", () => {
    it("comes from the template, and starts its patterns on its rhythms", () => {
      const { created } = renderModal();

      pickTemplate("West Coast Swing");
      fireEvent.press(screen.getByText("Create"));

      expect(created().list.dance).toBe("wcs");
      const sixes = created().patterns.filter((p) => p.counts === 6);
      expect(sixes.length).toBeGreaterThan(0);
      for (const pattern of sixes) expect(pattern.rhythm).toBe("1 2 3&4 5&6");
    });

    it("is none for a blank list, and can be picked", () => {
      const { created } = renderModal();

      pickTemplate("Blank");
      fireEvent.changeText(nameInput(), "Festival");
      expect(
        screen.getByRole("button", { name: "None" }).props.accessibilityState
          ?.selected,
      ).toBe(true);
      fireEvent.press(screen.getByText("Lindy Hop"));
      fireEvent.press(screen.getByText("Create"));

      expect(created().list.dance).toBe("lindy");
    });

    it("can be taken off a list being edited", () => {
      const list = { ...createTestPatternList(), dance: "salsa" as const };
      const { onSaveList } = renderModal({ editList: list });

      fireEvent.press(screen.getByText("None"));
      fireEvent.press(screen.getByText("Save"));

      expect(onSaveList.mock.calls[0][0]).not.toHaveProperty("dance");
    });
  });

  describe("edit mode", () => {
    const editable = () =>
      createTestPatternList({
        name: "West Coast Swing",
        patternTypes: [
          createPatternType("push", "#FF6B6B"),
          createPatternType("pass", "#4ECDC4"),
        ],
      });

    it("starts with the sections closed, each saying what it holds", () => {
      renderModal({ editList: editable() }, true);

      expect(screen.getByText("push, pass")).toBeTruthy();
      expect(screen.queryByText("Add type")).toBeNull();
      expect(screen.getByText("Save")).toBeTruthy();
    });

    it("opens and closes a section", () => {
      renderModal({ editList: editable() }, true);

      fireEvent.press(screen.getByText("Figure Types"));
      expect(screen.queryByText("push, pass")).toBeNull();
      fireEvent.press(screen.getByText("Figure Types"));
      expect(screen.getByText("push, pass")).toBeTruthy();
    });

    it("says what is wrong in a section closed on an invalid field", () => {
      renderModal({ editList: editable() }, true);

      fireEvent.press(screen.getByText("Figure Types"));
      fireEvent.changeText(screen.getByDisplayValue("push"), "pass");
      fireEvent.press(screen.getByText("Figure Types"));

      expect(screen.getByText("Name already used")).toBeTruthy();
    });

    it("opens straight into configure, skipping the picker", () => {
      renderModal({ editList: editable() });

      expect(screen.getByText("Configure Your List")).toBeOnTheScreen();
      expect(screen.queryByText("Choose a Starting Point")).toBeNull();
    });

    it("pre-fills the name and types of the list being edited", () => {
      renderModal({ editList: editable() });

      expect(nameInput().props.value).toBe("West Coast Swing");
      expect(typeInputs().map((i) => i.props.value)).toEqual(["push", "pass"]);
    });

    it("saves rather than creating", () => {
      const list = editable();
      const { onSaveList, onCreateList } = renderModal({ editList: list });

      fireEvent.changeText(nameInput(), "Renamed");
      fireEvent.press(screen.getByText("Save"));

      expect(onCreateList).not.toHaveBeenCalled();
      expect(onSaveList).toHaveBeenCalledWith(
        expect.objectContaining({ id: list.id, name: "Renamed" }),
        {},
        {},
      );
    });

    it("offers no starter patterns", () => {
      renderModal({ editList: editable() });

      expect(screen.queryByText("Starting Figures")).toBeNull();
    });

    it("cancels instead of stepping back to the picker", () => {
      const { onClose } = renderModal({ editList: editable() });

      fireEvent.press(screen.getByText("Cancel"));

      expect(onClose).toHaveBeenCalled();
      expect(screen.queryByText("Choose a Starting Point")).toBeNull();
    });

    it("says how many figures use a type", () => {
      const list = editable();
      const [push, pass] = list.patternTypes;
      renderModal({
        editList: list,
        typeUsage: { [push.id]: 3, [pass.id]: 1 },
      });

      expect(screen.getByText("Used by 3 figures")).toBeOnTheScreen();
      expect(screen.getByText("Used by 1 figure")).toBeOnTheScreen();
    });

    it("asks where the figures of a type in use go, then moves them on save", () => {
      const list = editable();
      const [push, pass] = list.patternTypes;
      const { onSaveList } = renderModal({
        editList: list,
        typeUsage: { [push.id]: 2 },
      });

      fireEvent.press(removeTypeButtons()[0]);

      expect(screen.getByText("Remove push")).toBeOnTheScreen();
      expect(
        screen.getByText("2 figures use push. Move them to:"),
      ).toBeOnTheScreen();
      // The other types are the choices, the first picked.
      expect(screen.getByRole("radio", { name: "pass" })).toBeSelected();
      expect(typeInputs()).toHaveLength(2);

      fireEvent.press(screen.getByText("Move and remove"));
      expect(typeInputs()).toHaveLength(1);
      // pass is the only type left now, holding push's figures.
      expect(screen.getByText(/^Used by 2 figures/)).toBeOnTheScreen();

      fireEvent.press(screen.getByText("Save"));
      const [saved, moves] = onSaveList.mock.calls[0];
      expect(saved.patternTypes.map((t) => t.id)).toEqual([pass.id]);
      expect(moves).toEqual({ [push.id]: pass.id });
    });

    it("keeps the type when the question is cancelled", () => {
      const list = editable();
      const [push] = list.patternTypes;
      const { onSaveList } = renderModal({
        editList: list,
        typeUsage: { [push.id]: 1 },
      });

      fireEvent.press(removeTypeButtons()[0]);
      expect(
        screen.getByText("1 figure uses push. Move it to:"),
      ).toBeOnTheScreen();
      // The dialog's Cancel, after the sheet's own in the tree.
      fireEvent.press(screen.getAllByText("Cancel").at(-1)!);
      fireEvent.press(screen.getByText("Save"));

      expect(typeInputs()).toHaveLength(2);
      expect(onSaveList.mock.calls[0][1]).toEqual({});
    });

    it("moves to the type picked, and follows a type that moves on again", () => {
      const list = editable();
      list.patternTypes.push(createPatternType("whip", "#45B7D1"));
      const [push, pass, whip] = list.patternTypes;
      const { onSaveList } = renderModal({
        editList: list,
        typeUsage: { [push.id]: 2, [pass.id]: 1 },
      });

      fireEvent.press(removeTypeButtons()[0]);
      fireEvent.press(screen.getByRole("radio", { name: "pass" }));
      fireEvent.press(screen.getByText("Move and remove"));
      // pass now holds its own figure and push's two.
      fireEvent.press(removeTypeButtons()[0]);
      expect(
        screen.getByText("3 figures use pass. Move them to:"),
      ).toBeOnTheScreen();
      fireEvent.press(screen.getByText("Move and remove"));
      fireEvent.press(screen.getByText("Save"));

      expect(onSaveList.mock.calls[0][1]).toEqual({
        [push.id]: whip.id,
        [pass.id]: whip.id,
      });
    });

    it("removes a type no figure uses without asking", () => {
      const list = editable();
      renderModal({
        editList: list,
        typeUsage: { [list.patternTypes[0].id]: 1 },
      });

      fireEvent.press(removeTypeButtons()[1]);

      expect(typeInputs()).toHaveLength(1);
      expect(screen.queryByText("Move and remove")).toBeNull();
    });

    it("will not remove the only type while figures use it, and says why", () => {
      const list = createTestPatternList({
        patternTypes: [createPatternType("push", "#FF6B6B")],
      });
      renderModal({
        editList: list,
        typeUsage: { [list.patternTypes[0].id]: 4 },
      });

      expect(removeTypeButtons()[0]).toBeDisabled();
      expect(screen.getByText(/The only type: add another/)).toBeOnTheScreen();
    });
  });

  describe("editing the levels", () => {
    const course = () =>
      createTestPatternList({
        levels: [
          { id: "c1", name: "1" },
          { id: "c2", name: "2" },
          { id: "c3", name: "3" },
        ],
      });

    it("starts a list on the built-in levels and stores none for them", () => {
      const { created } = renderModal();
      pickTemplate("West Coast Swing");

      expect(levelNames()).toEqual(["Beginner", "Intermediate", "Advanced"]);
      fireEvent.press(screen.getByText("Create"));
      expect(created().list).not.toHaveProperty("levels");
    });

    it("creates a list on course numbers from the preset, adding the next number", () => {
      const { created } = renderModal();
      pickTemplate("West Coast Swing");

      fireEvent.press(screen.getByText("Numbers 1, 2, 3 …"));
      expect(levelNames()).toEqual(["1", "2", "3"]);
      fireEvent.press(screen.getByText("Add level"));
      expect(levelNames()).toEqual(["1", "2", "3", "4"]);
      fireEvent.press(screen.getByText("Create"));

      expect(created().list.levels!.map((l) => l.name)).toEqual([
        "1",
        "2",
        "3",
        "4",
      ]);
    });

    it("starts the starter figures on a removed level without one", () => {
      const { created } = renderModal();
      pickTemplate("West Coast Swing");

      fireEvent.press(removeLevelButtons()[0]);
      fireEvent.press(screen.getByText("Create"));

      const { list, patterns } = created();
      expect(list.levels!.map((l) => l.id)).toEqual([
        "intermediate",
        "advanced",
      ]);
      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns.some((p) => p.level === "beginner")).toBe(false);
    });

    it("pre-fills the levels of the list being edited, and saves renames by id", () => {
      const list = course();
      const { onSaveList } = renderModal({ editList: list });

      expect(levelNames()).toEqual(["1", "2", "3"]);
      fireEvent.changeText(levelInputs()[1], "  Two  ");
      fireEvent.press(screen.getByText("Save"));

      expect(onSaveList.mock.calls[0][0].levels).toEqual([
        { id: "c1", name: "1" },
        { id: "c2", name: "Two" },
        { id: "c3", name: "3" },
      ]);
    });

    it("reorders with up and down, and cannot move past either end", () => {
      const { onSaveList } = renderModal({ editList: course() });

      expect(screen.getByLabelText("Move 1 up")).toBeDisabled();
      expect(screen.getByLabelText("Move 3 down")).toBeDisabled();
      fireEvent.press(screen.getByLabelText("Move 3 up"));
      expect(levelNames()).toEqual(["1", "3", "2"]);
      fireEvent.press(screen.getByLabelText("Move 1 down"));
      expect(levelNames()).toEqual(["3", "1", "2"]);
      fireEvent.press(screen.getByText("Save"));

      expect(onSaveList.mock.calls[0][0].levels!.map((l) => l.id)).toEqual([
        "c3",
        "c1",
        "c2",
      ]);
    });

    it("goes back to storing nothing when the built-ins are restored", () => {
      const list = createTestPatternList({ levels: undefined });
      const { onSaveList } = renderModal({ editList: list });

      fireEvent.press(screen.getByText("Numbers 1, 2, 3 …"));
      fireEvent.press(screen.getByText("Beginner / Intermediate / Advanced"));
      fireEvent.press(screen.getByText("Save"));

      expect(onSaveList.mock.calls[0][0]).not.toHaveProperty("levels");
    });

    it("blanks the names for own names, and will not save a blank or repeated one", () => {
      const { onSaveList } = renderModal({ editList: course() });

      fireEvent.press(screen.getByText("Own names"));
      expect(levelNames()).toEqual(["", "", ""]);
      fireEvent.press(screen.getByText("Save"));
      expect(onSaveList).not.toHaveBeenCalled();
      expect(screen.getAllByText("Name cannot be empty")).toHaveLength(3);

      fireEvent.changeText(levelInputs()[0], "Basics");
      fireEvent.changeText(levelInputs()[1], "basics");
      fireEvent.changeText(levelInputs()[2], "Social");
      expect(screen.getByText("basics: Name already used")).toBeOnTheScreen();
      fireEvent.press(screen.getByText("Save"));
      expect(onSaveList).not.toHaveBeenCalled();

      fireEvent.changeText(levelInputs()[1], "Styling");
      fireEvent.press(screen.getByText("Save"));
      expect(onSaveList.mock.calls[0][0].levels!.map((l) => l.name)).toEqual([
        "Basics",
        "Styling",
        "Social",
      ]);
    });

    it("stops at twelve levels and says so", () => {
      renderModal({ editList: course() });

      for (let i = 0; i < 12; i++)
        fireEvent.press(screen.getByText("Add level"));

      expect(levelInputs()).toHaveLength(12);
      expect(screen.getByText("Add level")).toBeDisabled();
      expect(
        screen.getByText("A list can have up to 12 levels"),
      ).toBeOnTheScreen();
    });

    it("removes a level no figure uses without asking, but never the last one", () => {
      renderModal({
        editList: createTestPatternList({
          levels: [
            { id: "a", name: "A" },
            { id: "b", name: "B" },
          ],
        }),
      });

      fireEvent.press(removeLevelButtons()[0]);
      expect(levelNames()).toEqual(["B"]);
      expect(screen.queryByText("Move and remove")).toBeNull();
      expect(removeLevelButtons()[0]).toBeDisabled();
    });

    it("asks where the figures of a level in use go, no level by default", () => {
      const { onSaveList } = renderModal({
        editList: course(),
        levelUsage: { c1: 2, c2: 1 },
      });

      expect(screen.getByText("Used by 2 figures")).toBeOnTheScreen();
      fireEvent.press(removeLevelButtons()[0]);
      expect(
        screen.getByText("2 figures use 1. Move them to:"),
      ).toBeOnTheScreen();
      expect(screen.getByRole("radio", { name: "No level" })).toBeSelected();
      expect(screen.getByRole("radio", { name: "2" })).toBeOnTheScreen();
      fireEvent.press(screen.getByText("Move and remove"));
      expect(levelNames()).toEqual(["2", "3"]);
      fireEvent.press(screen.getByText("Save"));

      const [saved, typeMoves, levelMoves] = onSaveList.mock.calls[0];
      expect(saved.levels!.map((l) => l.id)).toEqual(["c2", "c3"]);
      expect(typeMoves).toEqual({});
      expect(levelMoves).toEqual({ c1: "" });
    });

    it("moves them to the level picked, following it when that one goes too", () => {
      const { onSaveList } = renderModal({
        editList: course(),
        levelUsage: { c1: 2, c2: 1 },
      });

      fireEvent.press(removeLevelButtons()[0]);
      fireEvent.press(screen.getByRole("radio", { name: "2" }));
      fireEvent.press(screen.getByText("Move and remove"));
      expect(screen.getByText("Used by 3 figures")).toBeOnTheScreen();

      fireEvent.press(removeLevelButtons()[0]);
      fireEvent.press(screen.getByRole("radio", { name: "3" }));
      fireEvent.press(screen.getByText("Move and remove"));
      fireEvent.press(screen.getByText("Save"));

      expect(onSaveList.mock.calls[0][2]).toEqual({ c1: "c3", c2: "c3" });
    });

    it("keeps the level when the question is cancelled", () => {
      const { onSaveList } = renderModal({
        editList: course(),
        levelUsage: { c1: 1 },
      });

      fireEvent.press(removeLevelButtons()[0]);
      expect(
        screen.getByText("1 figure uses 1. Move it to:"),
      ).toBeOnTheScreen();
      fireEvent.press(screen.getAllByText("Cancel").at(-1)!);
      fireEvent.press(screen.getByText("Save"));

      expect(levelNames()).toEqual(["1", "2", "3"]);
      expect(onSaveList.mock.calls[0][2]).toEqual({});
    });
  });
});
