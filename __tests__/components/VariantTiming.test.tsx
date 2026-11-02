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

// Issues #134 (a variant's own counts and rhythm) and #135 (slows and quicks).

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

describe("a variant's own counts and rhythm, in the figure form", () => {
  it("sets the variant's counts from its rhythm, and leaves the figure's alone", async () => {
    const onAccepted = renderForm(whip());

    fireEvent.press(screen.getByLabelText("with Telemark"));
    openSection("Counts and rhythm of this variant");
    fireEvent.changeText(
      screen.getByLabelText("Rhythm of this variant"),
      "1 2 3&4&5 6",
    );

    expect(screen.getByLabelText("Counts of this variant").props.value).toBe(
      "6",
    );
    const saved = await save(onAccepted);
    expect(saved).toMatchObject({ counts: 8, rhythm: "1 2 3&4 5 6 7&8" });
    expect(saved.modifierRefs[0]).toEqual({
      modifierId: TELEMARK.id,
      videoRefs: [],
      counts: 6,
      rhythm: "1 2 3&4&5 6",
    });
  });

  it("drops the variant's rhythm when its counts change, and follows the figure with none", async () => {
    const onAccepted = renderForm(
      whip({
        modifierRefs: [
          {
            modifierId: TELEMARK.id,
            videoRefs: [],
            counts: 6,
            rhythm: "1 2 3&4&5 6",
          },
        ],
      }),
    );

    fireEvent.press(screen.getByLabelText("with Telemark"));
    // A variant with counts of its own opens on them.
    const counts = screen.getByLabelText("Counts of this variant");
    expect(screen.getByLabelText("Rhythm of this variant").props.value).toBe(
      "1 2 3&4&5 6",
    );

    fireEvent.changeText(counts, "8");
    expect(screen.getByLabelText("Rhythm of this variant").props.value).toBe(
      "",
    );
    fireEvent.changeText(screen.getByLabelText("Counts of this variant"), "");

    expect((await save(onAccepted)).modifierRefs[0]).toEqual({
      modifierId: TELEMARK.id,
      videoRefs: [],
    });
  });

  it("offers no counts or rhythm for a universal modifier", () => {
    renderForm(whip());

    fireEvent.press(screen.getByLabelText("Hesitation"));

    expect(
      screen.queryByRole("button", {
        name: "Counts and rhythm of this variant",
      }),
    ).toBeNull();
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

  it("shows the variant's counts and rhythm instead of the figure's", () => {
    renderDetails(
      whip({
        modifierRefs: [
          {
            modifierId: TELEMARK.id,
            videoRefs: [],
            counts: 6,
            rhythm: "1 2 3&4&5 6",
          },
        ],
      }),
    );
    expect(screen.getByText("1 2 3&4 5 6 7&8")).toBeOnTheScreen();

    fireEvent.press(screen.getByLabelText("with Telemark"));

    expect(screen.getByText("1 2 3&4&5 6")).toBeOnTheScreen();
    expect(screen.getByText("6")).toBeOnTheScreen();
    expect(screen.queryByText("1 2 3&4 5 6 7&8")).toBeNull();
  });

  it("shows the figure's own for a variant without any, and for a universal one", () => {
    renderDetails(whip());

    fireEvent.press(screen.getByLabelText("with Telemark"));
    expect(screen.getByText("1 2 3&4 5 6 7&8")).toBeOnTheScreen();
    fireEvent.press(screen.getByLabelText("Hesitation"));
    expect(screen.getByText("1 2 3&4 5 6 7&8")).toBeOnTheScreen();
    expect(screen.getByText("8")).toBeOnTheScreen();
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
    expect(screen.queryByLabelText("Add 2")).toBeNull();
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
