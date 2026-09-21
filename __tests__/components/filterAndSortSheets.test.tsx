import React from "react";
import PatternFilterBottomSheet, {
  PatternFilter,
} from "@/src/pattern/filter/components/PatternFilterBottomSheet";
import SortBottomSheet, {
  SortConfig,
} from "@/src/pattern/list/SortBottomSheet";
import TagPickerBottomSheet from "@/src/pattern/list/TagPickerBottomSheet";
import PatternTags from "@/src/pattern/list/PatternTags";
import { getPalette } from "@/src/common/utils/ColorPalette";
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

const palette = getPalette("light");
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
      fireEvent.press(screen.getByText("✕"));

      expect(onApplyFilter).not.toHaveBeenCalled();
    });

    it("puts the draft back to what was applied", () => {
      const current: PatternFilter = { ...emptyFilter, name: "whip" };
      renderSheet(current);

      fireEvent.changeText(
        screen.getByPlaceholderText("Search by name..."),
        "changed",
      );
      fireEvent.press(screen.getByText("✕"));

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

    expect(screen.getByText("↑")).toBeOnTheScreen();
  });

  it("shows a down arrow when descending", () => {
    renderSheet({ field: "name", order: "desc" });

    expect(screen.getByText("↓")).toBeOnTheScreen();
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

describe("TagPickerBottomSheet", () => {
  function renderPicker(
    selectedTags: string[] = [],
    allPatterns: IPattern[] = [],
  ) {
    const onAddTag = jest.fn<void, [string]>();
    const onClose = jest.fn();
    renderWithProviders(
      <TagPickerBottomSheet
        visible
        onClose={onClose}
        onAddTag={onAddTag}
        selectedTags={selectedTags}
        allPatterns={allPatterns}
      />,
      { activeListId: null },
    );
    return { onAddTag, onClose };
  }

  const search = (text: string) =>
    fireEvent.changeText(screen.getByPlaceholderText("Add tag"), text);

  const tagged = (id: number, tags: string[]) =>
    createTestPattern(PUSH.id, { id, tags });

  it("lists the tags already in use", () => {
    renderPicker([], [tagged(1, ["basic"]), tagged(2, ["advanced"])]);

    expect(screen.getByText("Existing tags")).toBeOnTheScreen();
    expect(screen.getByText("basic")).toBeOnTheScreen();
    expect(screen.getByText("advanced")).toBeOnTheScreen();
  });

  it("leaves out tags the pattern already has", () => {
    renderPicker(["basic"], [tagged(1, ["basic", "advanced"])]);

    expect(screen.queryByText("basic")).toBeNull();
    expect(screen.getByText("advanced")).toBeOnTheScreen();
  });

  it("adds an existing tag when it is tapped", () => {
    const { onAddTag } = renderPicker([], [tagged(1, ["basic"])]);

    fireEvent.press(screen.getByText("basic"));

    expect(onAddTag).toHaveBeenCalledWith("basic");
  });

  describe("searching", () => {
    it("narrows the list", () => {
      renderPicker([], [tagged(1, ["basic", "advanced"])]);

      search("adv");

      expect(screen.getByText("Matching tags")).toBeOnTheScreen();
      expect(screen.getByText("advanced")).toBeOnTheScreen();
      expect(screen.queryByText("basic")).toBeNull();
    });

    it("says when nothing matches", () => {
      renderPicker(["zzz"], [tagged(1, ["zzz"])]);

      search("zzz");

      expect(
        screen.getByText("No unused matching tags found"),
      ).toBeOnTheScreen();
    });
  });

  describe("creating a new tag", () => {
    it("offers to create what was typed", () => {
      renderPicker([], [tagged(1, ["basic"])]);

      search("footwork");

      expect(screen.getByText('+ Create "footwork"')).toBeOnTheScreen();
    });

    it("creates it when tapped", () => {
      const { onAddTag } = renderPicker([]);

      search("footwork");
      fireEvent.press(screen.getByText('+ Create "footwork"'));

      expect(onAddTag).toHaveBeenCalledWith("footwork");
    });

    it("does not offer to create one that already exists", () => {
      renderPicker([], [tagged(1, ["basic"])]);

      search("basic");

      expect(screen.queryByText('+ Create "basic"')).toBeNull();
    });

    it("ignores case when deciding it already exists", () => {
      renderPicker([], [tagged(1, ["Basic"])]);

      search("basic");

      expect(screen.queryByText('+ Create "basic"')).toBeNull();
    });

    it("does not offer to create one the pattern already has", () => {
      renderPicker(["basic"], []);

      search("basic");

      expect(screen.queryByText('+ Create "basic"')).toBeNull();
    });

    it("clears the search after adding, ready for the next", () => {
      renderPicker([]);

      search("footwork");
      fireEvent.press(screen.getByText('+ Create "footwork"'));

      expect(screen.getByPlaceholderText("Add tag").props.value).toBe("");
    });
  });

  it("forgets the search when closed", () => {
    const { onClose } = renderPicker([], [tagged(1, ["basic"])]);

    search("zzz");
    fireEvent.press(screen.getByText("✕"));

    expect(onClose).toHaveBeenCalled();
    expect(screen.getByPlaceholderText("Add tag").props.value).toBe("");
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

  it("lists the tags the pattern has", () => {
    renderTags(["basic", "6-count"]);

    expect(screen.getByText("basic")).toBeOnTheScreen();
    expect(screen.getByText("6-count")).toBeOnTheScreen();
  });

  it("removes one", () => {
    const { updated } = renderTags(["basic", "6-count"]);

    fireEvent.press(screen.getAllByText("×")[0]);

    expect(updated()).toEqual(["6-count"]);
  });

  describe("adding", () => {
    const openPicker = () => fireEvent.press(screen.getByLabelText("Add tag"));

    it("opens the picker", () => {
      renderTags([]);

      openPicker();

      expect(screen.getByPlaceholderText("Add tag")).toBeOnTheScreen();
    });

    it("appends what was chosen", () => {
      const { updated } = renderTags(
        ["basic"],
        [createTestPattern(PUSH.id, { id: 1, tags: ["basic", "advanced"] })],
      );

      openPicker();
      fireEvent.press(screen.getByText("advanced"));

      expect(updated()).toEqual(["basic", "advanced"]);
    });

    it("trims what was typed", () => {
      const { updated } = renderTags([]);

      openPicker();
      fireEvent.changeText(screen.getByPlaceholderText("Add tag"), "  spin  ");
      fireEvent.press(screen.getByText(/Create/));

      expect(updated()).toEqual(["spin"]);
    });

    it("refuses a duplicate, ignoring case", () => {
      const { setTags } = renderTags(["Basic"]);

      openPicker();
      fireEvent.changeText(screen.getByPlaceholderText("Add tag"), "basic");
      // The picker will not even offer to create it…
      expect(screen.queryByText(/Create/)).toBeNull();
      expect(setTags).not.toHaveBeenCalled();
    });

    it("refuses an entirely blank tag", () => {
      const { setTags } = renderTags([]);

      openPicker();
      fireEvent.changeText(screen.getByPlaceholderText("Add tag"), "   ");

      expect(screen.queryByText(/Create/)).toBeNull();
      expect(setTags).not.toHaveBeenCalled();
    });
  });
});
