import React from "react";
import EditPatternForm from "@/src/pattern/list/EditPatternForm";
import PatternDetails from "@/src/pattern/graph/PatternDetails";
import { IModifier, IPattern } from "@/src/pattern/types/IPatternList";
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

// Issues #134 (a variant's own values, edited in the figure form) and #135 (slows and quicks).

const TYPE = createTestPatternType({ slug: "whip" });
const TELEMARK: IModifier = {
  id: "m-telemark",
  name: "with Telemark",
  position: "amends",
  universal: false,
  videoRefs: [],
};
const HESITATION: IModifier = {
  id: "m-hesitation",
  name: "Hesitation",
  position: "amends",
  universal: true,
  videoRefs: [],
};

const whip = (overrides: Partial<IPattern> = {}) =>
  createTestPattern(TYPE.id, {
    id: 1,
    name: "Basic Whip",
    counts: 8,
    rhythm: "1 2 3&4 5 6 7&8",
    modifierRefs: [{ modifierId: TELEMARK.id, videoRefs: [] }],
    ...overrides,
  });

function openSection(title: string) {
  const header = screen.getByRole("button", { name: title });
  if (!header.props.accessibilityState?.expanded) fireEvent.press(header);
}

function renderForm(existing: IPattern) {
  const onAccepted = jest.fn().mockResolvedValue(true);
  renderWithProviders(
    <EditPatternForm
      patterns={[existing]}
      patternTypes={[TYPE]}
      modifiers={[TELEMARK, HESITATION]}
      onAccepted={onAccepted}
      onCancel={() => {}}
      existing={existing}
    />,
  );
  return onAccepted;
}

const save = async (onAccepted: jest.Mock) => {
  fireEvent.press(screen.getByText("Save"));
  await waitFor(() => expect(onAccepted).toHaveBeenCalled());
  return onAccepted.mock.calls[0][0] as IPattern;
};

describe("the figure form switched to a variant by the variant strip", () => {
  const counts = () => screen.getByLabelText("Counts");
  const rhythm = () => screen.getByPlaceholderText("e.g. 1 2 3&4 5&6");
  const description = () => screen.getByPlaceholderText("Description");
  const ownMarks = () => screen.queryAllByText("Own value");

  it("shows the figure's values, inherited, until one is changed", () => {
    renderForm(whip({ description: "Pulls the follower through." }));
    openSection("Rhythm");
    openSection("Description");

    fireEvent.press(screen.getByLabelText("with Telemark"));

    expect(counts().props.value).toBe("8");
    expect(rhythm().props.value).toBe("1 2 3&4 5 6 7&8");
    expect(description().props.value).toBe("Pulls the follower through.");
    expect(ownMarks()).toHaveLength(0);
    expect(screen.getByText(/You're editing this variant/)).toBeOnTheScreen();
  });

  it("keeps an edit as the variant's own, marked, and leaves the figure alone", async () => {
    const onAccepted = renderForm(whip());
    openSection("Rhythm");

    fireEvent.press(screen.getByLabelText("with Telemark"));
    fireEvent.changeText(rhythm(), "1 2 3&4&5 6");

    expect(counts().props.value).toBe("6");
    // The counts and the rhythm both differ from the figure's.
    expect(ownMarks()).toHaveLength(2);

    fireEvent.press(screen.getByText("Base"));
    expect(counts().props.value).toBe("8");
    expect(rhythm().props.value).toBe("1 2 3&4 5 6 7&8");
    expect(ownMarks()).toHaveLength(0);

    const saved = await save(onAccepted);
    expect(saved).toMatchObject({ counts: 8, rhythm: "1 2 3&4 5 6 7&8" });
    expect(saved.modifierRefs[0]).toEqual({
      modifierId: TELEMARK.id,
      videoRefs: [],
      overrides: { counts: 6, rhythm: "1 2 3&4&5 6" },
    });
  });

  it("composes a variant's own rhythm with the same bubbles, held elements too", async () => {
    const onAccepted = renderForm(whip());
    openSection("Rhythm");

    fireEvent.press(screen.getByLabelText("with Telemark"));
    // Back to the 7 of the figure's 7&8, then a quick 7&a8 with the a held.
    fireEvent.press(screen.getByLabelText("Remove 8"));
    fireEvent.press(screen.getByLabelText("Remove &"));
    fireEvent.press(screen.getByLabelText("Add &"));
    fireEvent.press(screen.getByRole("togglebutton", { name: "Hold" }));
    fireEvent.press(screen.getByLabelText("Add a, held"));
    fireEvent.press(screen.getByLabelText("Add 8"));

    expect(rhythm().props.value).toBe("1 2 3&4 5 6 7&(a)8");
    expect(counts().props.value).toBe("8");
    expect((await save(onAccepted)).modifierRefs[0].overrides).toEqual({
      counts: 8,
      rhythm: "1 2 3&4 5 6 7&(a)8",
    });
  });

  it("drops a variant's rhythm its new counts don't fit", async () => {
    const onAccepted = renderForm(whip());
    openSection("Rhythm");

    fireEvent.press(screen.getByLabelText("with Telemark"));
    fireEvent.changeText(counts(), "");
    // Nothing yet: the field waits for counts, and the variant still follows the figure.
    expect(counts().props.value).toBe("");
    expect(ownMarks()).toHaveLength(0);
    fireEvent.changeText(counts(), "6");

    expect(rhythm().props.value).toBe("");
    expect((await save(onAccepted)).modifierRefs[0].overrides).toEqual({
      counts: 6,
    });
  });

  it("resets a field to the figure's value, removing the override", async () => {
    const onAccepted = renderForm(
      whip({
        description: "Pulls the follower through.",
        modifierRefs: [
          {
            modifierId: TELEMARK.id,
            videoRefs: [],
            overrides: {
              counts: 6,
              rhythm: "1 2 3&4&5 6",
              description: "With a Telemark on 3&4&5.",
            },
          },
        ],
      }),
    );
    openSection("Description");

    fireEvent.press(screen.getByLabelText("with Telemark"));
    expect(description().props.value).toBe("With a Telemark on 3&4&5.");

    fireEvent.press(
      // Marked on the counts and on the rhythm; either resets both.
      screen.getAllByLabelText("Use the figure's counts and rhythm")[1],
    );
    expect(counts().props.value).toBe("8");
    fireEvent.press(screen.getByLabelText("Use the figure's description"));
    expect(description().props.value).toBe("Pulls the follower through.");
    expect(ownMarks()).toHaveLength(0);

    expect((await save(onAccepted)).modifierRefs[0]).toEqual({
      modifierId: TELEMARK.id,
      videoRefs: [],
    });
  });

  it("gives a variant its own level, and typing the figure's value back follows the figure", async () => {
    const onAccepted = renderForm(whip({ description: "Plain." }));
    openSection("Type and level");
    openSection("Description");

    fireEvent.press(screen.getByLabelText("with Telemark"));
    fireEvent.press(screen.getByLabelText("Advanced"));
    expect(screen.getByLabelText("Use the figure's level")).toBeOnTheScreen();
    fireEvent.changeText(description(), "Plain!");
    fireEvent.changeText(description(), "Plain.");

    const saved = await save(onAccepted);
    expect(saved.level).toBe("beginner");
    expect(saved.modifierRefs[0].overrides).toEqual({ level: "advanced" });
  });

  it("shows name, type, prerequisites and tags as the figure's, read-only", () => {
    renderForm(whip({ tags: ["classic"] }));
    openSection("Type and level");

    fireEvent.press(screen.getByLabelText("with Telemark"));

    expect(screen.getByPlaceholderText("Figure Name").props.editable).toBe(
      false,
    );
    expect(screen.getAllByText("Same for every variant").length).toBe(4);
    // Locked: the section shows what the figure has, and does not open.
    expect(screen.queryByRole("button", { name: /^Tags/ })).toBeNull();
    expect(screen.getByText("classic")).toBeOnTheScreen();
  });

  it("leaves the form on the figure for a universal modifier", async () => {
    const onAccepted = renderForm(whip());

    fireEvent.press(screen.getByLabelText("Hesitation"));
    fireEvent.changeText(counts(), "6");

    expect(screen.queryByText("Same for every variant")).toBeNull();
    const saved = await save(onAccepted);
    expect(saved.counts).toBe(6);
    expect(saved.modifierRefs[0]).not.toHaveProperty("overrides");
  });
});

describe("the figure details with a variant picked", () => {
  function renderDetails(pattern: IPattern) {
    renderWithProviders(
      <PatternDetails
        selectedPattern={pattern}
        patterns={[pattern]}
        patternTypes={[TYPE]}
        modifiers={[TELEMARK, HESITATION]}
      />,
    );
  }

  it("shows the variant's own counts, rhythm, level and description", () => {
    renderDetails(
      whip({
        description: "Pulls the follower through.",
        modifierRefs: [
          {
            modifierId: TELEMARK.id,
            videoRefs: [],
            overrides: {
              counts: 6,
              rhythm: "1 2 3&4&5 6",
              level: "advanced",
              description: "With a Telemark on 3&4&5.",
            },
          },
        ],
      }),
    );
    expect(screen.getByText("1 2 3&4 5 6 7&8")).toBeOnTheScreen();
    expect(screen.getByText("Beginner")).toBeOnTheScreen();

    fireEvent.press(screen.getByLabelText("with Telemark"));

    expect(screen.getByText("1 2 3&4&5 6")).toBeOnTheScreen();
    expect(screen.getByText("6")).toBeOnTheScreen();
    expect(screen.getByText("Advanced")).toBeOnTheScreen();
    expect(screen.getByText("With a Telemark on 3&4&5.")).toBeOnTheScreen();
    expect(screen.queryByText("1 2 3&4 5 6 7&8")).toBeNull();
    expect(screen.queryByText("Pulls the follower through.")).toBeNull();
  });

  it("shows the figure's where the variant has none of its own, and for a universal one", () => {
    renderDetails(
      whip({
        description: "Pulls the follower through.",
        modifierRefs: [
          {
            modifierId: TELEMARK.id,
            videoRefs: [],
            overrides: { level: "advanced" },
          },
        ],
      }),
    );

    fireEvent.press(screen.getByLabelText("with Telemark"));
    expect(screen.getByText("1 2 3&4 5 6 7&8")).toBeOnTheScreen();
    expect(screen.getByText("Pulls the follower through.")).toBeOnTheScreen();
    expect(screen.getByText("Advanced")).toBeOnTheScreen();
    fireEvent.press(screen.getByLabelText("Hesitation"));
    expect(screen.getByText("1 2 3&4 5 6 7&8")).toBeOnTheScreen();
    expect(screen.getByText("8")).toBeOnTheScreen();
    expect(screen.getByText("Beginner")).toBeOnTheScreen();
  });
});

describe("writing a rhythm in slows and quicks", () => {
  function renderNew() {
    const onAccepted = jest.fn().mockResolvedValue(true);
    renderWithProviders(
      <EditPatternForm
        patterns={[]}
        patternTypes={[TYPE]}
        modifiers={[]}
        onAccepted={onAccepted}
        onCancel={() => {}}
      />,
    );
    fireEvent.changeText(screen.getByPlaceholderText("Figure Name"), "Feather");
    openSection("Rhythm");
    return onAccepted;
  }
  const rhythmInput = () => screen.getByPlaceholderText("e.g. 1 2 3&4 5&6");

  it("starts with S or Q from an empty field, then offers only S and Q", async () => {
    const onAccepted = renderNew();

    fireEvent.press(screen.getByLabelText("Add S"));
    // After a slow or a quick: no beat, no & or a, no Hold.
    expect(screen.queryByLabelText("Add 1")).toBeNull();
    expect(screen.queryByLabelText("Add &")).toBeNull();
    expect(screen.queryByRole("togglebutton", { name: "Hold" })).toBeNull();
    fireEvent.press(screen.getByLabelText("Add Q"));
    fireEvent.press(screen.getByLabelText("Add Q"));

    expect(rhythmInput().props.value).toBe("S Q Q");
    expect(screen.getByPlaceholderText("Counts").props.value).toBe("4");
    expect(await save(onAccepted)).toMatchObject({
      counts: 4,
      rhythm: "S Q Q",
    });
  });

  it("offers no S or Q after beat numbers", () => {
    renderNew();

    fireEvent.press(screen.getByLabelText("Add 1"));

    expect(screen.queryByLabelText("Add S")).toBeNull();
    expect(screen.getByLabelText("Add 2")).toBeOnTheScreen();
    expect(screen.getByLabelText("Add &")).toBeOnTheScreen();
  });

  it("reads lower case, and saves it in capitals", async () => {
    const onAccepted = renderNew();

    fireEvent.changeText(rhythmInput(), "s s q q s");

    expect(screen.getByPlaceholderText("Counts").props.value).toBe("8");
    expect((await save(onAccepted)).rhythm).toBe("S S Q Q S");
  });

  it("explains a rhythm that mixes numbers with S and Q, or joins them with &", async () => {
    const onAccepted = renderNew();

    fireEvent.changeText(rhythmInput(), "S Q 3");
    expect(screen.getByText(/Numbers and S\/Q don't mix/)).toBeOnTheScreen();

    fireEvent.changeText(rhythmInput(), "S Q&Q");
    expect(screen.getByText(/Slows and quicks take no &/)).toBeOnTheScreen();
    expect(await save(onAccepted)).not.toHaveProperty("rhythm");
  });
});
