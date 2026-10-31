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

/** The rhythm field; its header row carries the same name. */
const rhythmInput = () => screen.getByPlaceholderText("e.g. 1 2 3&4 5&6");

/** Opens a folded part of the form, unless it is open already. */
function openSection(title: string) {
  const header = screen.getByRole("button", { name: title });
  if (!header.props.accessibilityState?.expanded) fireEvent.press(header);
}

function renderForm(patterns: IPattern[], existing?: IPattern) {
  const rendered = renderWithProviders(
    <EditPatternForm
      patterns={patterns}
      patternTypes={[TYPE]}
      modifiers={[]}
      onAccepted={noop}
      onCancel={noop}
      existing={existing}
    />,
  );
  openSection("Prerequisites");
  return rendered;
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
      screen.getByText("Greyed-out figures would create a prerequisite loop."),
    ).toBeOnTheScreen();
  });

  /** The prerequisite chips' labels, front to back, read off the picker's scroller. */
  const prerequisiteChips = (names: string[]) =>
    screen
      .getAllByRole("button")
      .map((b) => b.props.accessibilityLabel as string)
      .filter((label) => names.includes(label));

  it("puts the chosen first, then the most used, then the rest by name", () => {
    const patterns = [
      pattern(1, "Sugar Push"),
      pattern(2, "Whip", [1, 3]),
      pattern(3, "Underarm Turn"),
      pattern(4, "Tuck Turn", [3]),
      pattern(5, "Basket Whip", [1, 3]),
      pattern(6, "New", [2]),
    ];
    renderForm(patterns, patterns[5]);

    expect(prerequisiteChips(patterns.map((p) => p.name))).toEqual([
      "Whip",
      "Underarm Turn",
      "Sugar Push",
      "Basket Whip",
      "Tuck Turn",
      "New",
    ]);
  });

  it("puts a newly chosen prerequisite first", () => {
    const onAccepted = jest.fn().mockResolvedValue(true);
    const patterns = [
      pattern(1, "Sugar Push"),
      pattern(2, "Whip"),
      pattern(3, "Tuck Turn", [1]),
    ];
    renderWithProviders(
      <EditPatternForm
        patterns={patterns}
        patternTypes={[TYPE]}
        modifiers={[]}
        onAccepted={onAccepted}
        onCancel={noop}
        existing={patterns[2]}
      />,
    );
    openSection("Prerequisites");

    fireEvent.press(chipFor("Whip"));
    fireEvent.press(screen.getByText("Save"));

    expect(onAccepted.mock.calls[0][0].prerequisites).toEqual([2, 1]);
  });

  it("removes a chosen prerequisite when it is tapped", () => {
    const patterns = [pattern(1, "Sugar Push"), pattern(2, "Whip", [1])];
    renderForm(patterns, patterns[1]);

    fireEvent.press(chipFor("Sugar Push"));

    expect(isSelected("Sugar Push")).toBe(false);
  });

  it("narrows the choice fuzzily by name", () => {
    renderForm([pattern(1, "Sugar Push"), pattern(2, "Whip")]);

    fireEvent.changeText(
      screen.getByPlaceholderText("Search by name..."),
      "sgpsh",
    );

    expect(screen.getByLabelText("Sugar Push")).toBeOnTheScreen();
    expect(screen.queryByLabelText("Whip")).toBeNull();
  });

  it("stays quiet when nothing is disabled", () => {
    renderForm([pattern(1, "Sugar Push"), pattern(2, "Whip")]);

    expect(
      screen.queryByText(
        "Greyed-out figures would create a prerequisite loop.",
      ),
    ).toBeNull();
  });
});

describe("EditPatternForm save", () => {
  it("greys out Save until the pattern has a name, and says why when tapped", async () => {
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
    const save = () => screen.getByRole("button", { name: "Save" });
    const hint = "Give the figure a name to save it.";

    expect(save().props.accessibilityState?.disabled).toBe(true);
    expect(screen.queryByText(hint)).toBeNull();

    fireEvent.press(save());
    expect(screen.getByText(hint)).toBeTruthy();
    expect(onAccepted).not.toHaveBeenCalled();

    // Blank space is not a name.
    fireEvent.changeText(screen.getByPlaceholderText("Figure Name"), "  ");
    expect(save().props.accessibilityState?.disabled).toBe(true);

    fireEvent.changeText(screen.getByPlaceholderText("Figure Name"), "Whip");
    expect(save().props.accessibilityState?.disabled).toBe(false);
    expect(screen.queryByText(hint)).toBeNull();
    fireEvent.press(save());
    await waitFor(() => expect(onAccepted).toHaveBeenCalled());
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

    fireEvent.changeText(screen.getByPlaceholderText("Figure Name"), "Whip");
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
    fireEvent.changeText(screen.getByPlaceholderText("Figure Name"), "Whip");
    openSection("Rhythm");
    return onAccepted;
  }

  const save = async (onAccepted: jest.Mock) => {
    fireEvent.press(screen.getByText("Save"));
    await waitFor(() => expect(onAccepted).toHaveBeenCalled());
    return onAccepted.mock.calls[0][0];
  };

  it("sets the counts to the rhythm typed", async () => {
    const onAccepted = renderNew();

    fireEvent.changeText(rhythmInput(), "1 2 3&4 5 6 7&8");

    expect(screen.getByPlaceholderText("Counts").props.value).toBe("8");
    expect(await save(onAccepted)).toMatchObject({
      counts: 8,
      rhythm: "1 2 3&4 5 6 7&8",
    });
  });

  it("clears a rhythm the new counts no longer fit", async () => {
    const onAccepted = renderNew();
    fireEvent.changeText(rhythmInput(), "1 2 3&4 5&6");

    fireEvent.changeText(screen.getByPlaceholderText("Counts"), "8");

    expect(rhythmInput().props.value).toBe("");
    expect(await save(onAccepted)).not.toHaveProperty("rhythm");
  });

  it("says what is wrong with a rhythm that is not one, and saves without it", async () => {
    const onAccepted = renderNew();

    fireEvent.changeText(rhythmInput(), "1 2 4");

    expect(screen.getByText(/Not a rhythm yet/)).toBeOnTheScreen();
    expect(await save(onAccepted)).not.toHaveProperty("rhythm");
  });

  it("offers the dance's basic rhythms while the field is empty", async () => {
    const list = createTestPatternList({ dance: "wcs" });
    const onAccepted = renderNew({ lists: [list] });

    // A new pattern starts at 6 counts, which West Coast Swing has basic rhythms for.
    fireEvent.press(await screen.findByText("1 2 3a4 5a6"));

    expect(rhythmInput().props.value).toBe("1 2 3a4 5a6");
    expect(screen.queryByText("1 2 3&4 5&6")).toBeNull();
    expect(await save(onAccepted)).toMatchObject({
      counts: 6,
      rhythm: "1 2 3a4 5a6",
    });
  });

  it("offers no whole rhythm without a dance", async () => {
    renderNew({ lists: [createTestPatternList()] });

    expect(
      await screen.findByPlaceholderText("e.g. 1 2 3&4 5&6"),
    ).toBeOnTheScreen();
    expect(screen.queryByText("1 2 3&4 5&6")).toBeNull();
  });
});

describe("EditPatternForm new type", () => {
  const PASS = createTestPatternType({ slug: "pass" });

  it("adds a type from the picker and selects it", async () => {
    const onAccepted = jest.fn().mockResolvedValue(true);
    const onAddType = jest.fn().mockResolvedValue(PASS);
    renderWithProviders(
      <EditPatternForm
        patterns={[]}
        patternTypes={[TYPE]}
        modifiers={[]}
        onAccepted={onAccepted}
        onCancel={noop}
        onAddType={onAddType}
      />,
    );
    fireEvent.changeText(screen.getByPlaceholderText("Figure Name"), "Whip");

    fireEvent.press(screen.getByText("New type"));
    fireEvent.changeText(screen.getByLabelText("Type name"), "pass");
    fireEvent.press(screen.getAllByText("Add type").at(-1)!);
    await waitFor(() => expect(onAddType).toHaveBeenCalledWith("pass"));

    fireEvent.press(screen.getByText("Save"));
    await waitFor(() => expect(onAccepted).toHaveBeenCalled());
    expect(onAccepted.mock.calls[0][0].typeId).toBe(PASS.id);
  });

  it("says so when the name is already used", async () => {
    const onAddType = jest.fn().mockResolvedValue(null);
    renderWithProviders(
      <EditPatternForm
        patterns={[]}
        patternTypes={[TYPE]}
        modifiers={[]}
        onAccepted={noop}
        onCancel={noop}
        onAddType={onAddType}
      />,
    );

    fireEvent.press(screen.getByText("New type"));
    fireEvent.changeText(screen.getByLabelText("Type name"), "push");
    fireEvent.press(screen.getAllByText("Add type").at(-1)!);

    expect(await screen.findByText("Name already used")).toBeOnTheScreen();
  });

  it("offers no new type without a way to add one", () => {
    renderForm([]);

    expect(screen.queryByText("New type")).toBeNull();
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
    fireEvent.changeText(screen.getByPlaceholderText("Figure Name"), "Whip");
    openSection("Rhythm");

    for (const step of ["1", "2", "3&4", "5", "6", "7a8"]) {
      fireEvent.press(screen.getByLabelText(`Add ${step}`));
    }

    expect(rhythmInput().props.value).toBe("1 2 3&4 5 6 7a8");
    expect(screen.getByPlaceholderText("Counts").props.value).toBe("8");
    fireEvent.press(screen.getByText("Save"));
    await waitFor(() =>
      expect(onAccepted).toHaveBeenCalledWith(
        expect.objectContaining({ counts: 8, rhythm: "1 2 3&4 5 6 7a8" }),
      ),
    );
  });

  it("takes back a mistapped step with the undo bubble", () => {
    renderWithProviders(
      <EditPatternForm
        patterns={[]}
        patternTypes={[TYPE]}
        modifiers={[]}
        onAccepted={noop}
        onCancel={noop}
      />,
    );
    openSection("Rhythm");
    expect(screen.queryByText("Undo")).toBeNull();

    for (const step of ["1", "2", "3a4"]) {
      fireEvent.press(screen.getByLabelText(`Add ${step}`));
    }
    fireEvent.press(screen.getByLabelText("Remove 3a4"));
    fireEvent.press(screen.getByLabelText("Add 3&4"));

    expect(rhythmInput().props.value).toBe("1 2 3&4");
    expect(screen.getByPlaceholderText("Counts").props.value).toBe("4");
  });

  it("rolls a triple on into a rolling count, and undoes one beat of it", async () => {
    // The Telemark, as review 2's tester counts it: 1 2 3&4&5 6.
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
    fireEvent.changeText(
      screen.getByPlaceholderText("Figure Name"),
      "Telemark",
    );
    openSection("Rhythm");
    for (const step of ["1", "2"]) {
      fireEvent.press(screen.getByLabelText(`Add ${step}`));
    }
    expect(screen.queryByLabelText(/to the last step/)).toBeNull();

    fireEvent.press(screen.getByLabelText("Add 3&4"));
    fireEvent.press(screen.getByLabelText("Add &5 to the last step"));
    fireEvent.press(screen.getByLabelText("Add &6 to the last step"));
    fireEvent.press(screen.getByLabelText("Remove &6"));
    fireEvent.press(screen.getByLabelText("Add 6"));

    expect(rhythmInput().props.value).toBe("1 2 3&4&5 6");
    expect(screen.getByPlaceholderText("Counts").props.value).toBe("6");
    fireEvent.press(screen.getByText("Save"));
    await waitFor(() =>
      expect(onAccepted).toHaveBeenCalledWith(
        expect.objectContaining({ counts: 6, rhythm: "1 2 3&4&5 6" }),
      ),
    );
  });
});

describe("EditPatternForm layout", () => {
  it("puts the videos before the type, and folds the rest away on a new pattern", () => {
    renderWithProviders(
      <EditPatternForm
        patterns={[]}
        patternTypes={[TYPE]}
        modifiers={[]}
        onAccepted={noop}
        onCancel={noop}
      />,
    );
    const texts = screen.UNSAFE_root.findAll(
      (node) => typeof node.props.children === "string",
    ).map((node) => node.props.children as string);
    expect(texts.indexOf("Videos")).toBeGreaterThan(-1);
    expect(texts.indexOf("Videos")).toBeLessThan(texts.indexOf("Type"));

    for (const title of ["Rhythm", "Description", "Prerequisites", "Tags"]) {
      const header = screen.getByRole("button", { name: title });
      expect(header.props.accessibilityState?.expanded).toBe(false);
    }
    expect(screen.queryByPlaceholderText("Description")).toBeNull();
  });

  it("opens the parts that hold something, and says what a folded one holds", () => {
    const base = pattern(1, "Sugar Push");
    const whip = createTestPattern(TYPE.id, {
      id: 2,
      name: "Whip",
      prerequisites: [1],
      description: "Turn on 3",
      tags: [],
    });
    renderForm([base, whip], whip);

    expect(screen.getByPlaceholderText("Description").props.value).toBe(
      "Turn on 3",
    );
    expect(
      screen.getByRole("button", { name: "Tags" }).props.accessibilityState
        ?.expanded,
    ).toBe(false);

    fireEvent.press(screen.getByRole("button", { name: "Description" }));
    expect(screen.queryByPlaceholderText("Description")).toBeNull();
    expect(screen.getByText("Turn on 3")).toBeOnTheScreen();
    expect(screen.getAllByText("None").length).toBeGreaterThan(0);
  });
});
