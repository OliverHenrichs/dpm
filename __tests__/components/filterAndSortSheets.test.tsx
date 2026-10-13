import React from "react";
import PatternFilterBottomSheet, {
  PatternFilter,
} from "@/src/pattern/filter/components/PatternFilterBottomSheet";
import SortBottomSheet, {
  SortConfig,
} from "@/src/pattern/list/SortBottomSheet";
import PatternTags from "@/src/pattern/list/PatternTags";
import { PatternLevel } from "@/src/pattern/types/PatternLevel";
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

const PUSH = createTestPatternType({ slug: "push" });
const PASS = createTestPatternType({ slug: "pass" });

const emptyFilter: PatternFilter = {
  name: "",
  types: [],
  levels: [],
  counts: undefined,
  tags: [],
};

describe("PatternFilterBottomSheet", () => {
  function renderSheet(
    currentFilter: PatternFilter = emptyFilter,
    allPatterns: IPattern[] = [],
  ) {
    const onApplyFilter = jest.fn<void, [PatternFilter]>();
    const onClose = jest.fn();
    renderWithProviders(
      <PatternFilterBottomSheet
        visible
        onClose={onClose}
        onApplyFilter={onApplyFilter}
        currentFilter={currentFilter}
        allPatterns={allPatterns}
        patternTypes={[PUSH, PASS]}
      />,
      { activeListId: null },
    );
    const applied = () => onApplyFilter.mock.calls.at(-1)![0];
    return { onApplyFilter, onClose, applied };
  }

  const apply = () => fireEvent.press(screen.getByText("Apply"));

  it("offers every pattern type", () => {
    renderSheet();

    expect(screen.getByText("push")).toBeOnTheScreen();
    expect(screen.getByText("pass")).toBeOnTheScreen();
  });

  it("gathers the tags in use across the patterns", () => {
    renderSheet(emptyFilter, [
      createTestPattern(PUSH.id, { id: 1, tags: ["basic"] }),
      createTestPattern(PUSH.id, { id: 2, tags: ["basic", "advanced"] }),
    ]);

    // Deduplicated: "basic" appears on two patterns but once as a chip.
    expect(screen.getAllByText("basic")).toHaveLength(1);
    expect(screen.getByText("advanced")).toBeOnTheScreen();
  });

  describe("applying", () => {
    it("passes the typed name through", () => {
      const { applied } = renderSheet();

      fireEvent.changeText(
        screen.getByPlaceholderText("Search by name..."),
        "whip",
      );
      apply();

      expect(applied().name).toBe("whip");
    });

    it("toggles a type on", () => {
      const { applied } = renderSheet();

      fireEvent.press(screen.getByText("push"));
      apply();

      expect(applied().types).toEqual([PUSH.id]);
    });

    it("toggles a type back off", () => {
      const { applied } = renderSheet();

      fireEvent.press(screen.getByText("push"));
      fireEvent.press(screen.getByText("push"));
      apply();

      expect(applied().types).toEqual([]);
    });

    it("accumulates several types", () => {
      const { applied } = renderSheet();

      fireEvent.press(screen.getByText("push"));
      fireEvent.press(screen.getByText("pass"));
      apply();

      expect(applied().types).toHaveLength(2);
    });

    it("toggles a level", () => {
      const { applied } = renderSheet();

      // The chips show the translated label, not the enum value.
      fireEvent.press(screen.getByText("Advanced"));
      apply();

      expect(applied().levels).toEqual([PatternLevel.ADVANCED]);
    });

    it("toggles a tag", () => {
      const { applied } = renderSheet(emptyFilter, [
        createTestPattern(PUSH.id, { id: 1, tags: ["basic"] }),
      ]);

      fireEvent.press(screen.getByText("basic"));
      apply();

      expect(applied().tags).toEqual(["basic"]);
    });

    it("closes once applied", () => {
      const { onClose } = renderSheet();

      apply();

      expect(onClose).toHaveBeenCalled();
    });
  });

  describe("resetting", () => {
    it("clears everything and applies immediately", () => {
      const { applied } = renderSheet({
        ...emptyFilter,
        name: "whip",
        types: [PUSH.id],
      });

      fireEvent.press(screen.getByText("Reset"));

      expect(applied()).toEqual(emptyFilter);
    });

    it("leaves the sheet open so more can be chosen", () => {
      const { onClose } = renderSheet();

      fireEvent.press(screen.getByText("Reset"));

      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe("cancelling", () => {
    it("discards edits rather than applying them", () => {
      const current: PatternFilter = { ...emptyFilter, name: "whip" };
      const { onApplyFilter } = renderSheet(current);

      fireEvent.changeText(
        screen.getByPlaceholderText("Search by name..."),
        "changed",
      );
      fireEvent.press(screen.getByLabelText("Close"));

      expect(onApplyFilter).not.toHaveBeenCalled();
    });

    it("puts the draft back to what was applied", () => {
      const current: PatternFilter = { ...emptyFilter, name: "whip" };
      renderSheet(current);

      fireEvent.changeText(
        screen.getByPlaceholderText("Search by name..."),
        "changed",
      );
      fireEvent.press(screen.getByLabelText("Close"));

      expect(screen.getByPlaceholderText("Search by name...").props.value).toBe(
        "whip",
      );
    });
  });
});

describe("SortBottomSheet", () => {
  function renderSheet(
    currentSort: SortConfig = { field: "name", order: "asc" },
  ) {
    const onApplySort = jest.fn<void, [SortConfig]>();
    const onClose = jest.fn();
    renderWithProviders(
      <SortBottomSheet
        visible
        onClose={onClose}
        onApplySort={onApplySort}
        currentSort={currentSort}
      />,
      { activeListId: null },
    );
    const applied = () => onApplySort.mock.calls.at(-1)![0];
    return { onApplySort, onClose, applied };
  }

  it("offers every sortable field", () => {
    renderSheet();

    for (const label of ["Name", "Type", "Level", "Counts", "Date Created"]) {
      expect(screen.getByText(label)).toBeOnTheScreen();
    }
  });

  it("marks the active field with its direction", () => {
    renderSheet({ field: "name", order: "asc" });

    expect(screen.getByLabelText("Name, ascending")).toBeOnTheScreen();
  });

  it("shows a down arrow when descending", () => {
    renderSheet({ field: "name", order: "desc" });

    expect(screen.getByLabelText("Name, descending")).toBeOnTheScreen();
  });

  it("sorts ascending when a new field is chosen", () => {
    const { applied } = renderSheet({ field: "name", order: "desc" });

    fireEvent.press(screen.getByText("Counts"));

    expect(applied()).toEqual({ field: "counts", order: "asc" });
  });

  it("flips direction when the active field is chosen again", () => {
    const { applied } = renderSheet({ field: "name", order: "asc" });

    fireEvent.press(screen.getByText("Name"));

    expect(applied()).toEqual({ field: "name", order: "desc" });
  });

  it("flips back on a third press", () => {
    const { applied } = renderSheet({ field: "name", order: "desc" });

    fireEvent.press(screen.getByText("Name"));

    expect(applied()).toEqual({ field: "name", order: "asc" });
  });

  it("closes after choosing", () => {
    const { onClose } = renderSheet();

    fireEvent.press(screen.getByText("Counts"));

    expect(onClose).toHaveBeenCalled();
  });
});

describe("PatternTags", () => {
  function renderTags(tags: string[] = [], allPatterns: IPattern[] = []) {
    const setTags = jest.fn<void, [string[]]>();
    renderWithProviders(
      <PatternTags tags={tags} setTags={setTags} allPatterns={allPatterns} />,
      { activeListId: null },
    );
    const updated = () => setTags.mock.calls.at(-1)![0];
    return { setTags, updated };
  }

  const search = (text: string) =>
    fireEvent.changeText(
      screen.getByPlaceholderText("Search or add a tag..."),
      text,
    );

  const tagged = (id: number, tags: string[]) =>
    createTestPattern(PUSH.id, { id, tags });

  /** The chips' labels, front to back. */
  const chipLabels = () =>
    screen
      .getAllByRole("button")
      .map((b) => b.props.accessibilityLabel as string);

  const isSelected = (label: string) =>
    screen.getByLabelText(label).props.accessibilityState?.selected === true;

  it("shows the pattern's tags chosen, ahead of the list's others", () => {
    renderTags(["basic"], [tagged(1, ["basic", "advanced"])]);

    expect(chipLabels()).toEqual(["basic", "advanced"]);
    expect(isSelected("basic")).toBe(true);
    expect(isSelected("advanced")).toBe(false);
  });

  it("orders the others by how many patterns use them", () => {
    renderTags(
      [],
      [
        tagged(1, ["rare", "common"]),
        tagged(2, ["common", "medium"]),
        tagged(3, ["common", "medium"]),
      ],
    );

    expect(chipLabels()).toEqual(["common", "medium", "rare"]);
  });

  it("removes a chosen tag when it is tapped", () => {
    const { updated } = renderTags(["basic", "6-count"]);

    fireEvent.press(screen.getByLabelText("basic"));

    expect(updated()).toEqual(["6-count"]);
  });

  it("puts a newly chosen tag first", () => {
    const { updated } = renderTags(
      ["basic"],
      [tagged(1, ["basic", "advanced"])],
    );

    fireEvent.press(screen.getByLabelText("advanced"));

    expect(updated()).toEqual(["advanced", "basic"]);
  });

  describe("searching", () => {
    it("narrows the others fuzzily, keeping the chosen in view", () => {
      renderTags(["basic"], [tagged(1, ["advanced", "footwork"])]);

      search("advncd");

      expect(screen.getByLabelText("advanced")).toBeOnTheScreen();
      expect(screen.queryByLabelText("footwork")).toBeNull();
      expect(screen.getByLabelText("basic")).toBeOnTheScreen();
    });

    it("ignores case and accents", () => {
      renderTags([], [tagged(1, ["Écart"])]);

      search("ecart");

      expect(screen.getByLabelText("Écart")).toBeOnTheScreen();
    });
  });

  describe("creating a new tag", () => {
    it("offers to create what was typed, and puts it first", () => {
      const { updated } = renderTags(["basic"]);

      search("  footwork  ");
      fireEvent.press(screen.getByText('Create "footwork"'));

      expect(updated()).toEqual(["footwork", "basic"]);
    });

    it("creates it from the keyboard too", () => {
      const { updated } = renderTags([]);

      search("footwork");
      fireEvent(
        screen.getByPlaceholderText("Search or add a tag..."),
        "submitEditing",
      );

      expect(updated()).toEqual(["footwork"]);
    });

    it("clears the search after creating, ready for the next", () => {
      renderTags([]);

      search("footwork");
      fireEvent.press(screen.getByText('Create "footwork"'));

      expect(
        screen.getByPlaceholderText("Search or add a tag...").props.value,
      ).toBe("");
    });

    it("does not offer to create one the list has, ignoring case", () => {
      renderTags([], [tagged(1, ["Basic"])]);

      search("basic");

      expect(screen.queryByText(/Create/)).toBeNull();
    });

    it("does not offer to create one the pattern has, ignoring case", () => {
      const { setTags } = renderTags(["Basic"]);

      search("basic");
      fireEvent(
        screen.getByPlaceholderText("Search or add a tag..."),
        "submitEditing",
      );

      expect(screen.queryByText(/Create/)).toBeNull();
      expect(setTags).not.toHaveBeenCalled();
    });

    it("does not offer to create a blank tag", () => {
      renderTags([]);

      search("   ");

      expect(screen.queryByText(/Create/)).toBeNull();
    });
  });
});
