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
) {
  const onCreateList = jest.fn<void, [IPatternList, NewPattern[]]>();
  const onSaveList = jest.fn<void, [IPatternList]>();
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

      expect(screen.getByText("Starting Patterns")).toBeOnTheScreen();
      expect(screen.getAllByText("✓").length).toBeGreaterThan(0);
    });

    it("offers no starter patterns for a blank list", () => {
      renderModal();

      pickTemplate("Blank");

      expect(screen.queryByText("Starting Patterns")).toBeNull();
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
      const before = screen.getAllByText("✓").length;
      fireEvent.press(screen.getAllByText("✓")[0]);
      fireEvent.press(screen.getByText("Create"));

      expect(screen.queryAllByText("✓")).toHaveLength(before - 1);
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
      fireEvent.press(screen.getAllByText("✕")[0]);

      expect(typeInputs()).toHaveLength(before - 1);
    });

    it("unticks starter patterns whose type was removed", () => {
      // Otherwise a pattern would be created against a type that is not there.
      renderModal();

      pickTemplate("West Coast Swing");
      const before = screen.getAllByText("✓").length;
      fireEvent.press(screen.getAllByText("✕")[0]);

      expect(screen.queryAllByText("✓").length).toBeLessThan(before);
    });

    it("never creates a pattern for a type that was removed", () => {
      const { created } = renderModal();

      pickTemplate("West Coast Swing");
      fireEvent.press(screen.getAllByText("✕")[0]);
      fireEvent.press(screen.getByText("Create"));

      const typeIds = new Set(created().list.patternTypes.map((t) => t.id));
      for (const pattern of created().patterns) {
        expect(typeIds.has(pattern.typeId)).toBe(true);
      }
    });
  });

  describe("picking a type colour", () => {
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

  describe("edit mode", () => {
    const editable = () =>
      createTestPatternList({
        name: "West Coast Swing",
        patternTypes: [
          createPatternType("push", "#FF6B6B"),
          createPatternType("pass", "#4ECDC4"),
        ],
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
      );
    });

    it("offers no starter patterns", () => {
      renderModal({ editList: editable() });

      expect(screen.queryByText("Starting Patterns")).toBeNull();
    });

    it("cancels instead of stepping back to the picker", () => {
      const { onClose } = renderModal({ editList: editable() });

      fireEvent.press(screen.getByText("Cancel"));

      expect(onClose).toHaveBeenCalled();
      expect(screen.queryByText("Choose a Starting Point")).toBeNull();
    });

    it("refuses to remove a type that still has patterns", () => {
      const list = editable();
      renderModal({
        editList: list,
        usedTypeIds: new Set([list.patternTypes[0].id]),
      });

      fireEvent.press(screen.getAllByText("✕")[0]);

      expect(typeInputs()).toHaveLength(2);
    });

    it("still allows removing a type with no patterns", () => {
      const list = editable();
      renderModal({
        editList: list,
        usedTypeIds: new Set([list.patternTypes[0].id]),
      });

      fireEvent.press(screen.getAllByText("✕")[1]);

      expect(typeInputs()).toHaveLength(1);
    });
  });
});
