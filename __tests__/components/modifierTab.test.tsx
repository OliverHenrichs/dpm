import React from "react";
import * as ImagePicker from "expo-image-picker";
import ModifierList from "@/src/pattern/list/ModifierList";
import EditModifierForm from "@/src/pattern/list/EditModifierForm";
import {
  IModifier,
  IPattern,
  NewModifier,
} from "@/src/pattern/types/IPatternList";
import { generateUUID } from "@/src/pattern/types/PatternType";
import {
  createTestPattern,
  createTestPatternType,
} from "@/utils/testFactories";
import {
  fireEvent,
  renderWithProviders,
  screen,
  waitFor,
} from "@/utils/renderWithProviders";

const mockedPicker = ImagePicker.launchImageLibraryAsync as jest.MockedFunction<
  typeof ImagePicker.launchImageLibraryAsync
>;

beforeEach(() => {
  mockedPicker.mockResolvedValue({ canceled: true } as never);
});

const TYPE = createTestPatternType({ slug: "push" });

const modifier = (
  name: string,
  overrides: Partial<IModifier> = {},
): IModifier => ({
  id: generateUUID(),
  name,
  position: "postfix",
  universal: false,
  videoRefs: [],
  ...overrides,
});

const localVideo = (value: string) => ({ type: "local" as const, value });

// ---------------------------------------------------------------------------

function renderList(
  modifiers: IModifier[] = [],
  patterns: IPattern[] = [],
  isReadonly = false,
) {
  const onAdd = jest.fn();
  const onEdit = jest.fn<void, [IModifier]>();
  const onDelete = jest.fn<void, [string]>();
  renderWithProviders(
    <ModifierList
      modifiers={modifiers}
      patterns={patterns}
      patternTypes={[TYPE]}
      isReadonly={isReadonly}
      onAdd={onAdd}
      onEdit={onEdit}
      onDelete={onDelete}
    />,
    { activeListId: null },
  );
  return { onAdd, onEdit, onDelete };
}

describe("ModifierList", () => {
  describe("empty state", () => {
    it("invites the user to add one", () => {
      renderList([]);

      expect(screen.getByText("No modifiers yet")).toBeOnTheScreen();
      expect(screen.getByText("Tap + to add a modifier")).toBeOnTheScreen();
    });

    it("drops the hint on a read-only list, where there is no + to tap", () => {
      renderList([], [], true);

      expect(screen.getByText("No modifiers yet")).toBeOnTheScreen();
      expect(screen.queryByText("Tap + to add a modifier")).toBeNull();
      expect(screen.queryByLabelText("Add Modifier")).toBeNull();
    });
  });

  describe("listing", () => {
    it("shows each modifier", () => {
      renderList([modifier("with a spin"), modifier("slow")]);

      expect(screen.getByText("with a spin")).toBeOnTheScreen();
      expect(screen.getByText("slow")).toBeOnTheScreen();
    });

    it("badges a universal one", () => {
      renderList([modifier("slow", { universal: true })]);

      expect(screen.getByText("UNIVERSAL")).toBeOnTheScreen();
    });

    it("hides edit and delete on a read-only list", () => {
      renderList([modifier("with a spin")], [], true);

      expect(screen.queryByLabelText("Edit Modifier")).toBeNull();
      expect(screen.queryByLabelText("Delete Modifier")).toBeNull();
    });
  });

  describe("acting on one", () => {
    it("asks to edit it", () => {
      const spin = modifier("with a spin");
      const { onEdit } = renderList([spin]);

      fireEvent.press(screen.getByLabelText("Edit Modifier"));

      expect(onEdit).toHaveBeenCalledWith(spin);
    });

    it("confirms before deleting", () => {
      const { onDelete } = renderList([modifier("with a spin")]);

      fireEvent.press(screen.getByLabelText("Delete Modifier"));

      expect(
        screen.getByText("Are you sure you want to delete this modifier?"),
      ).toBeOnTheScreen();
      expect(onDelete).not.toHaveBeenCalled();
    });

    it("deletes once confirmed", () => {
      const spin = modifier("with a spin");
      const { onDelete } = renderList([spin]);

      fireEvent.press(screen.getByLabelText("Delete Modifier"));
      fireEvent.press(screen.getByText("Delete"));

      expect(onDelete).toHaveBeenCalledWith(spin.id);
    });

    it("keeps it when the confirmation is dismissed", () => {
      const { onDelete } = renderList([modifier("with a spin")]);

      fireEvent.press(screen.getByLabelText("Delete Modifier"));
      fireEvent.press(screen.getByText("Cancel"));

      expect(onDelete).not.toHaveBeenCalled();
    });
  });

  describe("expanding one", () => {
    it("lists the patterns it is attached to", () => {
      const spin = modifier("with a spin");
      const patterns = [
        createTestPattern(TYPE.id, {
          id: 1,
          name: "Whip",
          modifierRefs: [{ modifierId: spin.id, videoRefs: [] }],
        }),
        createTestPattern(TYPE.id, { id: 2, name: "Sugar Push" }),
      ];
      renderList([spin], patterns);

      fireEvent.press(screen.getByLabelText("with a spin"));

      expect(screen.getByText("Whip")).toBeOnTheScreen();
      expect(screen.queryByText("Sugar Push")).toBeNull();
    });

    it("says so when it is attached to nothing", () => {
      renderList([modifier("with a spin")], []);

      fireEvent.press(screen.getByLabelText("with a spin"));

      expect(
        screen.getByText("Not applied to any pattern yet"),
      ).toBeOnTheScreen();
    });

    it("does not list patterns for a universal one, which applies to all", () => {
      const slow = modifier("slow", { universal: true });
      renderList([slow], [createTestPattern(TYPE.id, { id: 1, name: "Whip" })]);

      fireEvent.press(screen.getByLabelText("slow"));

      expect(screen.queryByText("Applied to:")).toBeNull();
    });

    it("collapses again when tapped a second time", () => {
      renderList([modifier("with a spin")], []);

      fireEvent.press(screen.getByLabelText("with a spin"));
      expect(
        screen.getByText("Not applied to any pattern yet"),
      ).toBeOnTheScreen();

      fireEvent.press(screen.getByLabelText("with a spin"));
      expect(screen.queryByText("Not applied to any pattern yet")).toBeNull();
    });
  });
});

// ---------------------------------------------------------------------------

function renderForm(existing?: IModifier) {
  const onAccepted = jest.fn<void, [NewModifier | IModifier]>();
  const onCancel = jest.fn();
  renderWithProviders(
    <EditModifierForm
      onAccepted={onAccepted}
      onCancel={onCancel}
      existing={existing}
    />,
    { activeListId: null },
  );
  const saved = () => onAccepted.mock.calls.at(-1)![0];
  return { onAccepted, onCancel, saved };
}

const nameField = () => screen.getByPlaceholderText("Modifier Name");
const saveModifier = () => fireEvent.press(screen.getByText("Save"));
const universalSwitch = () =>
  screen.UNSAFE_getByType(require("react-native").Switch);

describe("EditModifierForm", () => {
  describe("creating", () => {
    it("starts blank and defaults to amending", () => {
      renderForm();

      expect(screen.getByText("Add Modifier")).toBeOnTheScreen();
      expect(nameField().props.value).toBe("");
    });

    it("hands over what was entered", () => {
      const { saved } = renderForm();

      fireEvent.changeText(nameField(), "with a spin");
      fireEvent.press(screen.getByText("Postfix"));
      saveModifier();

      expect(saved()).toMatchObject({
        name: "with a spin",
        position: "postfix",
        universal: false,
      });
    });

    it("refuses a blank name", () => {
      const { onAccepted } = renderForm();

      saveModifier();

      expect(onAccepted).not.toHaveBeenCalled();
    });

    it("refuses a name that is only whitespace", () => {
      const { onAccepted } = renderForm();

      fireEvent.changeText(nameField(), "   ");
      saveModifier();

      expect(onAccepted).not.toHaveBeenCalled();
    });

    it("cancels without saving", () => {
      const { onCancel, onAccepted } = renderForm();

      fireEvent.changeText(nameField(), "with a spin");
      fireEvent.press(screen.getByText("Cancel"));

      expect(onCancel).toHaveBeenCalled();
      expect(onAccepted).not.toHaveBeenCalled();
    });
  });

  describe("editing", () => {
    it("pre-fills from the modifier being edited", () => {
      renderForm(modifier("with a spin", { position: "prefix" }));

      expect(screen.getByText("Edit Modifier")).toBeOnTheScreen();
      expect(nameField().props.value).toBe("with a spin");
    });

    it("keeps the id so the caller updates rather than inserts", () => {
      const spin = modifier("with a spin");
      const { saved } = renderForm(spin);

      fireEvent.changeText(nameField(), "renamed");
      saveModifier();

      expect(saved()).toMatchObject({ id: spin.id, name: "renamed" });
    });
  });

  describe("videos", () => {
    it("offers none for a per-pattern modifier", () => {
      // Those live on each pattern's attachment, not on the modifier.
      renderForm(modifier("with a spin", { universal: false }));

      expect(screen.queryByLabelText("Add")).toBeNull();
    });

    it("offers them once it is made universal", () => {
      renderForm(modifier("slow", { universal: false }));

      fireEvent(universalSwitch(), "valueChange", true);

      expect(screen.getByLabelText("Add")).toBeOnTheScreen();
    });

    it("attaches a URL video", async () => {
      const { saved } = renderForm(modifier("slow", { universal: true }));

      fireEvent.press(screen.getByLabelText("Add"));
      await waitFor(() =>
        expect(screen.getByPlaceholderText("https://...")).toBeOnTheScreen(),
      );
      fireEvent.changeText(
        screen.getByPlaceholderText("https://..."),
        "https://youtu.be/slow",
      );
      fireEvent.press(screen.getByText(/Add URL/));
      saveModifier();

      expect(saved().videoRefs).toEqual([
        { type: "url", value: "https://youtu.be/slow" },
      ]);
    });

    it("removes one", () => {
      const { saved } = renderForm(
        modifier("slow", {
          universal: true,
          videoRefs: [localVideo("file:///a.mp4"), localVideo("file:///b.mp4")],
        }),
      );

      fireEvent.press(screen.getAllByLabelText("Remove video")[0]);
      saveModifier();

      expect(saved().videoRefs).toEqual([localVideo("file:///b.mp4")]);
    });

    it("stops at three", () => {
      renderForm(
        modifier("slow", {
          universal: true,
          videoRefs: [
            localVideo("file:///a.mp4"),
            localVideo("file:///b.mp4"),
            localVideo("file:///c.mp4"),
          ],
        }),
      );

      expect(
        screen.getByLabelText("Add").props.accessibilityState?.disabled,
      ).toBe(true);
    });

    it("keeps videos attached when universal is switched back off", () => {
      // Observed behaviour, not necessarily desired: IModifier.videoRefs are
      // documented as used only while `universal`, so these are carried along
      // invisibly and reappear if it is switched on again.
      const { saved } = renderForm(
        modifier("slow", {
          universal: true,
          videoRefs: [localVideo("file:///a.mp4")],
        }),
      );

      fireEvent(universalSwitch(), "valueChange", false);
      saveModifier();

      expect(saved().universal).toBe(false);
      expect(saved().videoRefs).toEqual([localVideo("file:///a.mp4")]);
    });
  });
});
