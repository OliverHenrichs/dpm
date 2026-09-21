import React from "react";
import * as ImagePicker from "expo-image-picker";
import EditPatternForm from "@/src/pattern/list/EditPatternForm";
import {
  IModifier,
  IPattern,
  NewPattern,
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

function renderForm(
  existing?: IPattern,
  modifiers: IModifier[] = [],
  patterns: IPattern[] = [],
) {
  const onAccepted = jest.fn<void, [NewPattern | IPattern]>();
  const onCancel = jest.fn();
  renderWithProviders(
    <EditPatternForm
      patterns={patterns}
      patternTypes={[TYPE]}
      modifiers={modifiers}
      onAccepted={onAccepted}
      onCancel={onCancel}
      existing={existing}
    />,
    { activeListId: null },
  );
  /** What the form handed over on the most recent save. */
  const saved = () => onAccepted.mock.calls.at(-1)![0];
  return { onAccepted, onCancel, saved };
}

const save = () => fireEvent.press(screen.getByText("Save"));
const addVideoButton = () => screen.getByLabelText("Add");
const removeButtons = () => screen.queryAllByLabelText("Remove video");

/** Open the add-video sheet and enter a URL. */
async function addUrlVideo(url: string, startTime?: string) {
  fireEvent.press(addVideoButton());
  await waitFor(() =>
    expect(screen.getByPlaceholderText("https://...")).toBeOnTheScreen(),
  );
  fireEvent.changeText(screen.getByPlaceholderText("https://..."), url);
  if (startTime !== undefined) {
    fireEvent.changeText(
      screen.getByPlaceholderText("Start time (e.g. 1:30 or 90)"),
      startTime,
    );
  }
  fireEvent.press(screen.getByText(/Add URL/));
}

describe("EditPatternForm — videos", () => {
  describe("adding by URL", () => {
    it("attaches the URL to the pattern", async () => {
      const { saved } = renderForm(
        createTestPattern(TYPE.id, { id: 1, name: "Whip" }),
      );

      await addUrlVideo("https://youtu.be/abc123");
      save();

      expect(saved().videoRefs).toEqual([
        { type: "url", value: "https://youtu.be/abc123" },
      ]);
    });

    it("keeps a start time when one is given", async () => {
      const { saved } = renderForm(
        createTestPattern(TYPE.id, { id: 1, name: "Whip" }),
      );

      await addUrlVideo("https://youtu.be/abc123", "1:23");
      save();

      expect(saved().videoRefs[0]).toEqual({
        type: "url",
        value: "https://youtu.be/abc123",
        startTime: 83,
      });
    });

    it("refuses something that is not a URL", async () => {
      const { saved } = renderForm(
        createTestPattern(TYPE.id, { id: 1, name: "Whip" }),
      );

      fireEvent.press(addVideoButton());
      await waitFor(() =>
        expect(screen.getByPlaceholderText("https://...")).toBeOnTheScreen(),
      );
      fireEvent.changeText(
        screen.getByPlaceholderText("https://..."),
        "not-a-url",
      );
      fireEvent.press(screen.getByText(/Add URL/));

      save();
      expect(saved().videoRefs).toEqual([]);
    });
  });

  describe("adding from the library", () => {
    it("attaches every picked video as a local reference", async () => {
      mockedPicker.mockResolvedValue({
        canceled: false,
        assets: [{ uri: "file:///a.mp4" }, { uri: "file:///b.mp4" }],
      } as never);
      const { saved } = renderForm(
        createTestPattern(TYPE.id, { id: 1, name: "Whip" }),
      );

      fireEvent.press(addVideoButton());
      await waitFor(() =>
        expect(screen.getByText(/Pick from Library/)).toBeOnTheScreen(),
      );
      fireEvent.press(screen.getByText(/Pick from Library/));

      await waitFor(() => expect(mockedPicker).toHaveBeenCalled());
      save();
      expect(saved().videoRefs).toEqual([
        localVideo("file:///a.mp4"),
        localVideo("file:///b.mp4"),
      ]);
    });

    it("adds nothing when the picker is cancelled", async () => {
      mockedPicker.mockResolvedValue({ canceled: true } as never);
      const { saved } = renderForm(
        createTestPattern(TYPE.id, { id: 1, name: "Whip" }),
      );

      fireEvent.press(addVideoButton());
      await waitFor(() =>
        expect(screen.getByText(/Pick from Library/)).toBeOnTheScreen(),
      );
      fireEvent.press(screen.getByText(/Pick from Library/));

      await waitFor(() => expect(mockedPicker).toHaveBeenCalled());
      save();
      expect(saved().videoRefs).toEqual([]);
    });

    it("only asks for as many as will fit under the cap of three", async () => {
      mockedPicker.mockResolvedValue({ canceled: true } as never);
      renderForm(
        createTestPattern(TYPE.id, {
          id: 1,
          name: "Whip",
          videoRefs: [localVideo("file:///a.mp4")],
        }),
      );

      fireEvent.press(addVideoButton());
      await waitFor(() =>
        expect(screen.getByText(/Pick from Library/)).toBeOnTheScreen(),
      );
      fireEvent.press(screen.getByText(/Pick from Library/));

      await waitFor(() =>
        expect(mockedPicker).toHaveBeenCalledWith(
          expect.objectContaining({ selectionLimit: 2 }),
        ),
      );
    });
  });

  describe("removing", () => {
    it("drops the chosen video and keeps the rest", () => {
      const { saved } = renderForm(
        createTestPattern(TYPE.id, {
          id: 1,
          name: "Whip",
          videoRefs: [localVideo("file:///a.mp4"), localVideo("file:///b.mp4")],
        }),
      );

      fireEvent.press(removeButtons()[0]);
      save();

      expect(saved().videoRefs).toEqual([localVideo("file:///b.mp4")]);
    });
  });

  describe("the three-video cap", () => {
    it("disables adding once three are attached", () => {
      renderForm(
        createTestPattern(TYPE.id, {
          id: 1,
          name: "Whip",
          videoRefs: [
            localVideo("file:///a.mp4"),
            localVideo("file:///b.mp4"),
            localVideo("file:///c.mp4"),
          ],
        }),
      );

      expect(addVideoButton().props.accessibilityState?.disabled).toBe(true);
    });

    it("leaves it enabled below the cap", () => {
      renderForm(
        createTestPattern(TYPE.id, {
          id: 1,
          name: "Whip",
          videoRefs: [localVideo("file:///a.mp4")],
        }),
      );

      expect(addVideoButton().props.accessibilityState?.disabled).toBeFalsy();
    });
  });
});

describe("EditPatternForm — a refused save", () => {
  /**
   * `usePatternCrud` refuses a blank name and `PatternListManager` then leaves
   * the modal open, so the form stays mounted. It used to reset itself
   * regardless, destroying the edit — including the pattern's id, after which
   * saving again failed with "Cannot edit pattern without id" and the form
   * could only be escaped by cancelling.
   */
  const refuse = () => jest.fn<false, [NewPattern | IPattern]>(() => false);

  function renderRefusing(existing: IPattern) {
    const onAccepted = refuse();
    renderWithProviders(
      <EditPatternForm
        patterns={[]}
        patternTypes={[TYPE]}
        modifiers={[]}
        onAccepted={onAccepted}
        onCancel={jest.fn()}
        existing={existing}
      />,
      { activeListId: null },
    );
    return { onAccepted };
  }

  const editable = () =>
    createTestPattern(TYPE.id, {
      id: 7,
      name: "Whip",
      counts: 8,
      description: "The money move",
      tags: ["advanced"],
      videoRefs: [localVideo("file:///a.mp4")],
    });

  it("keeps the other fields the user had entered", async () => {
    renderRefusing(editable());

    fireEvent.changeText(screen.getByPlaceholderText("Pattern Name"), "");
    save();

    await waitFor(() =>
      expect(screen.getByPlaceholderText("Counts").props.value).toBe("8"),
    );
    expect(screen.getByPlaceholderText("Description").props.value).toBe(
      "The money move",
    );
  });

  it("keeps the attached videos", async () => {
    renderRefusing(editable());

    fireEvent.changeText(screen.getByPlaceholderText("Pattern Name"), "");
    save();

    await waitFor(() => expect(removeButtons()).toHaveLength(1));
  });

  it("keeps the pattern's id, so a second attempt can still succeed", async () => {
    const { onAccepted } = renderRefusing(editable());

    fireEvent.changeText(screen.getByPlaceholderText("Pattern Name"), "");
    save();
    await waitFor(() => expect(onAccepted).toHaveBeenCalledTimes(1));

    fireEvent.changeText(screen.getByPlaceholderText("Pattern Name"), "Whip");
    save();

    await waitFor(() => expect(onAccepted).toHaveBeenCalledTimes(2));
    expect(onAccepted.mock.calls[1][0]).toMatchObject({ id: 7, name: "Whip" });
  });

  it("still clears the form when the save is accepted", async () => {
    const onAccepted = jest.fn(() => true);
    renderWithProviders(
      <EditPatternForm
        patterns={[]}
        patternTypes={[TYPE]}
        modifiers={[]}
        onAccepted={onAccepted}
        onCancel={jest.fn()}
      />,
      { activeListId: null },
    );

    fireEvent.changeText(screen.getByPlaceholderText("Pattern Name"), "New");
    save();

    await waitFor(() =>
      expect(screen.getByPlaceholderText("Pattern Name").props.value).toBe(""),
    );
  });

  it("still clears it when the caller reports nothing at all", async () => {
    // A caller that returns void is treated as acceptance, so older callers
    // keep their existing behaviour.
    const onAccepted = jest.fn();
    renderWithProviders(
      <EditPatternForm
        patterns={[]}
        patternTypes={[TYPE]}
        modifiers={[]}
        onAccepted={onAccepted}
        onCancel={jest.fn()}
      />,
      { activeListId: null },
    );

    fireEvent.changeText(screen.getByPlaceholderText("Pattern Name"), "New");
    save();

    await waitFor(() =>
      expect(screen.getByPlaceholderText("Pattern Name").props.value).toBe(""),
    );
  });
});

describe("EditPatternForm — modifiers", () => {
  it("shows the base pill and nothing else with no modifiers attached", () => {
    renderForm(createTestPattern(TYPE.id, { id: 1, name: "Whip" }), [
      modifier("with a spin"),
    ]);

    expect(screen.getByText("Base")).toBeOnTheScreen();
    expect(screen.queryByText("with a spin")).toBeNull();
  });

  it("attaches a modifier chosen from the picker", () => {
    const spin = modifier("with a spin");
    const { saved } = renderForm(
      createTestPattern(TYPE.id, { id: 1, name: "Whip" }),
      [spin],
    );

    fireEvent.press(screen.getByText("Attach..."));
    fireEvent.press(screen.getByText("with a spin"));
    save();

    expect(saved().modifierRefs).toEqual([
      { modifierId: spin.id, videoRefs: [] },
    ]);
  });

  it("detaches one that was attached", () => {
    const spin = modifier("with a spin");
    const { saved } = renderForm(
      createTestPattern(TYPE.id, {
        id: 1,
        name: "Whip",
        modifierRefs: [{ modifierId: spin.id, videoRefs: [] }],
      }),
      [spin],
    );

    fireEvent.press(screen.getByLabelText("Detach modifier: with a spin"));
    save();

    expect(saved().modifierRefs).toEqual([]);
  });

  describe("videos are scoped to the selected variant", () => {
    it("shows the pattern's own videos under Base", () => {
      const spin = modifier("with a spin");
      renderForm(
        createTestPattern(TYPE.id, {
          id: 1,
          name: "Whip",
          videoRefs: [localVideo("file:///base.mp4")],
          modifierRefs: [
            {
              modifierId: spin.id,
              videoRefs: [
                localVideo("file:///combo-a.mp4"),
                localVideo("file:///combo-b.mp4"),
              ],
            },
          ],
        }),
        [spin],
      );

      // One video under Base → one remove button.
      expect(removeButtons()).toHaveLength(1);
    });

    it("swaps to the combination's videos when its pill is chosen", () => {
      const spin = modifier("with a spin");
      renderForm(
        createTestPattern(TYPE.id, {
          id: 1,
          name: "Whip",
          videoRefs: [localVideo("file:///base.mp4")],
          modifierRefs: [
            {
              modifierId: spin.id,
              videoRefs: [
                localVideo("file:///combo-a.mp4"),
                localVideo("file:///combo-b.mp4"),
              ],
            },
          ],
        }),
        [spin],
      );

      fireEvent.press(screen.getByText("with a spin"));

      expect(removeButtons()).toHaveLength(2);
    });

    it("adds a new video to the selected combination, not to the base", async () => {
      const spin = modifier("with a spin");
      const { saved } = renderForm(
        createTestPattern(TYPE.id, {
          id: 1,
          name: "Whip",
          videoRefs: [],
          modifierRefs: [{ modifierId: spin.id, videoRefs: [] }],
        }),
        [spin],
      );

      fireEvent.press(screen.getByText("with a spin"));
      await addUrlVideo("https://youtu.be/combo");
      save();

      expect(saved().videoRefs).toEqual([]);
      expect(saved().modifierRefs[0].videoRefs).toEqual([
        { type: "url", value: "https://youtu.be/combo" },
      ]);
    });
  });

  describe("a universal modifier", () => {
    it("says its videos are managed elsewhere", () => {
      const slow = modifier("slow", {
        universal: true,
        videoRefs: [localVideo("file:///slow.mp4")],
      });
      renderForm(createTestPattern(TYPE.id, { id: 1, name: "Whip" }), [slow]);

      fireEvent.press(screen.getByText("slow"));

      expect(
        screen.getByText("Videos managed in Modifiers tab"),
      ).toBeOnTheScreen();
    });

    it("will not let them be added to from here", () => {
      const slow = modifier("slow", { universal: true, videoRefs: [] });
      renderForm(createTestPattern(TYPE.id, { id: 1, name: "Whip" }), [slow]);

      fireEvent.press(screen.getByText("slow"));

      expect(addVideoButton().props.accessibilityState?.disabled).toBe(true);
    });
  });
});
