import React from "react";
import EditPatternForm from "@/src/pattern/list/EditPatternForm";
import { IPattern } from "@/src/pattern/types/IPatternList";
import {
  createTestPattern,
  createTestPatternType,
} from "@/utils/testFactories";
import {
  fireEvent,
  renderWithProviders,
  screen,
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
