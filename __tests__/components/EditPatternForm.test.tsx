import React from "react";
import EditPatternForm from "@/src/pattern/list/EditPatternForm";
import { IPattern } from "@/src/pattern/types/IPatternList";
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
} from "@/utils/renderWithProviders";

const TYPE = createTestPatternType({ slug: "push" });

const noop = () => {};

function pattern(id: number, name: string, prerequisites: number[] = []) {
  return createTestPattern(TYPE.id, { id, name, prerequisites });
}

function renderForm(patterns: IPattern[], existing?: IPattern) {
  return renderWithProviders(
    <EditPatternForm
      patterns={patterns}
      patternTypes={[TYPE]}
      modifiers={[]}
      onAccepted={noop}
      onCancel={noop}
      existing={existing}
    />,
  );
}

/** The prerequisite chip for a pattern. Chips expose their name as a label. */
const chipFor = (name: string) => screen.getByLabelText(name);

const isDisabled = (name: string) =>
  chipFor(name).props.accessibilityState?.disabled === true;

const isSelected = (name: string) =>
  chipFor(name).props.accessibilityState?.selected === true;

describe("EditPatternForm prerequisite picker", () => {
  it("offers every other pattern when editing a leaf", () => {
    const patterns = [pattern(1, "Sugar Push"), pattern(2, "Whip", [1])];
    renderForm(patterns, patterns[1]);

    expect(isDisabled("Sugar Push")).toBe(false);
  });

  it("will not let a pattern be its own prerequisite", () => {
    const patterns = [pattern(1, "Sugar Push")];
    renderForm(patterns, patterns[0]);

    expect(isDisabled("Sugar Push")).toBe(true);
  });

  it("will not let a direct dependent become a prerequisite", () => {
    // Whip already requires Sugar Push, so requiring Whip for Sugar Push
    // would mean neither could ever be learned first.
    const patterns = [pattern(1, "Sugar Push"), pattern(2, "Whip", [1])];
    renderForm(patterns, patterns[0]);

    expect(isDisabled("Whip")).toBe(true);
  });

  it("will not let a transitive dependent become a prerequisite", () => {
    const patterns = [
      pattern(1, "Sugar Push"),
      pattern(2, "Whip", [1]),
      pattern(3, "Basket Whip", [2]),
    ];
    renderForm(patterns, patterns[0]);

    expect(isDisabled("Basket Whip")).toBe(true);
  });

  it("leaves unrelated patterns selectable", () => {
    const patterns = [
      pattern(1, "Sugar Push"),
      pattern(2, "Whip", [1]),
      pattern(3, "Tuck Turn"),
    ];
    renderForm(patterns, patterns[0]);

    expect(isDisabled("Tuck Turn")).toBe(false);
  });

  it("ignores a disabled chip when it is pressed", () => {
    const patterns = [pattern(1, "Sugar Push"), pattern(2, "Whip", [1])];
    renderForm(patterns, patterns[0]);

    fireEvent.press(chipFor("Whip"));

    // Still disabled, and nothing was selected — the press did nothing.
    expect(isDisabled("Whip")).toBe(true);
  });

  it("still allows an ordinary selection", () => {
    const patterns = [
      pattern(1, "Sugar Push"),
      pattern(2, "Whip"),
      pattern(3, "Tuck Turn"),
    ];
    renderForm(patterns, patterns[0]);

    fireEvent.press(chipFor("Whip"));

    expect(isSelected("Whip")).toBe(true);
  });

  it("disables nothing when creating a new pattern", () => {
    // Nothing can depend on a pattern that does not exist yet.
    const patterns = [pattern(1, "Sugar Push"), pattern(2, "Whip", [1])];
    renderForm(patterns);

    expect(isDisabled("Sugar Push")).toBe(false);
    expect(isDisabled("Whip")).toBe(false);
  });

  it("explains why some chips are unavailable", () => {
    const patterns = [pattern(1, "Sugar Push"), pattern(2, "Whip", [1])];
    renderForm(patterns, patterns[0]);

    expect(
      screen.getByText("Greyed-out patterns would create a prerequisite loop."),
    ).toBeOnTheScreen();
  });

  it("stays quiet when nothing is disabled", () => {
    renderForm([pattern(1, "Sugar Push"), pattern(2, "Whip")]);

    expect(
      screen.queryByText(
        "Greyed-out patterns would create a prerequisite loop.",
      ),
    ).toBeNull();
  });
});

describe("EditPatternForm level", () => {
  it("starts without a level, and clears one when tapped again", async () => {
    const onAccepted = jest.fn().mockResolvedValue(true);
    renderWithProviders(
      <EditPatternForm
        patterns={[]}
        patternTypes={[TYPE]}
        modifiers={[]}
        onAccepted={onAccepted}
        onCancel={noop}
      />,
    );

    expect(isSelected("Beginner")).toBe(false);
    fireEvent.press(chipFor("Beginner"));
    expect(isSelected("Beginner")).toBe(true);
    fireEvent.press(chipFor("Beginner"));
    expect(isSelected("Beginner")).toBe(false);

    fireEvent.changeText(screen.getByPlaceholderText("Pattern Name"), "Whip");
    fireEvent.press(screen.getByText("Save"));

    await waitFor(() => expect(onAccepted).toHaveBeenCalled());
    // The key is gone rather than undefined, which Firestore would reject.
    expect(onAccepted.mock.calls[0][0]).not.toHaveProperty("level");
  });
});

describe("EditPatternForm rhythm", () => {
  function renderNew(lists?: Parameters<typeof renderWithProviders>[1]) {
    const onAccepted = jest.fn().mockResolvedValue(true);
    renderWithProviders(
      <EditPatternForm
        patterns={[]}
        patternTypes={[TYPE]}
        modifiers={[]}
        onAccepted={onAccepted}
        onCancel={noop}
      />,
      lists,
    );
    fireEvent.changeText(screen.getByPlaceholderText("Pattern Name"), "Whip");
    return onAccepted;
  }

  const save = async (onAccepted: jest.Mock) => {
    fireEvent.press(screen.getByText("Save"));
    await waitFor(() => expect(onAccepted).toHaveBeenCalled());
    return onAccepted.mock.calls[0][0];
  };

  it("sets the counts to the rhythm typed", async () => {
    const onAccepted = renderNew();

    fireEvent.changeText(screen.getByLabelText("Rhythm"), "1 2 3&4 5 6 7&8");

    expect(screen.getByPlaceholderText("Counts").props.value).toBe("8");
    expect(await save(onAccepted)).toMatchObject({
      counts: 8,
      rhythm: "1 2 3&4 5 6 7&8",
    });
  });

  it("clears a rhythm the new counts no longer fit", async () => {
    const onAccepted = renderNew();
    fireEvent.changeText(screen.getByLabelText("Rhythm"), "1 2 3&4 5&6");

    fireEvent.changeText(screen.getByPlaceholderText("Counts"), "8");

    expect(screen.getByLabelText("Rhythm").props.value).toBe("");
    expect(await save(onAccepted)).not.toHaveProperty("rhythm");
  });

  it("says what is wrong with a rhythm that is not one, and saves without it", async () => {
    const onAccepted = renderNew();

    fireEvent.changeText(screen.getByLabelText("Rhythm"), "1 2 4");

    expect(screen.getByText(/Not a rhythm yet/)).toBeOnTheScreen();
    expect(await save(onAccepted)).not.toHaveProperty("rhythm");
  });

  it("suggests the list's dance rhythms for the counts", async () => {
    const list = createTestPatternList({ dance: "wcs" });
    const onAccepted = renderNew({ lists: [list] });

    // A new pattern starts at 6 counts.
    fireEvent.press(await screen.findByText("1 2 3&4 5&6"));

    expect(screen.getByLabelText("Rhythm").props.value).toBe("1 2 3&4 5&6");
    expect(await save(onAccepted)).toMatchObject({ rhythm: "1 2 3&4 5&6" });
  });
});

describe("EditPatternForm composing a rhythm", () => {
  it("builds a rhythm from the next-step bubbles", async () => {
    const onAccepted = jest.fn().mockResolvedValue(true);
    renderWithProviders(
      <EditPatternForm
        patterns={[]}
        patternTypes={[TYPE]}
        modifiers={[]}
        onAccepted={onAccepted}
        onCancel={noop}
      />,
    );
    fireEvent.changeText(screen.getByPlaceholderText("Pattern Name"), "Whip");

    for (const step of ["1", "2", "3&4", "5", "6", "7a8"]) {
      fireEvent.press(screen.getByLabelText(`Add ${step}`));
    }

    expect(screen.getByLabelText("Rhythm").props.value).toBe("1 2 3&4 5 6 7a8");
    expect(screen.getByPlaceholderText("Counts").props.value).toBe("8");
    fireEvent.press(screen.getByText("Save"));
    await waitFor(() =>
      expect(onAccepted).toHaveBeenCalledWith(
        expect.objectContaining({ counts: 8, rhythm: "1 2 3&4 5 6 7a8" }),
      ),
    );
  });
});
