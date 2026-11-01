import React from "react";
import EditPatternForm from "@/src/pattern/list/EditPatternForm";
import PatternList from "@/src/pattern/list/PatternList";
import Legend from "@/src/pattern/graph/Legend";
import PatternDetails from "@/src/pattern/graph/PatternDetails";
import PatternFilterBottomSheet, {
  PatternFilter,
} from "@/src/pattern/filter/components/PatternFilterBottomSheet";
import { reelMeta } from "@/src/reels/components/ReelCaption";
import { collectReels } from "@/src/reels/reels";
import { IPattern, IPatternList } from "@/src/pattern/types/IPatternList";
import {
  createTestPattern,
  createTestPatternList,
} from "@/utils/testFactories";
import {
  fireEvent,
  renderWithProviders,
  screen,
  waitFor,
  within,
} from "@/utils/renderWithProviders";
import i18n from "@/src/i18n";

/**
 * A list on course numbers rather than Beginner / Intermediate / Advanced (tester review 2,
 * "Own levels"): every place a level is picked, shown or filtered by uses them, in their order.
 */
const COURSE = [
  { id: "c1", name: "Course 1" },
  { id: "c2", name: "Course 2" },
  { id: "c3", name: "Course 3" },
];

function courseList(): IPatternList {
  return createTestPatternList({ name: "Courses", levels: COURSE });
}

const noop = () => {};

describe("a list with levels of its own", () => {
  it("offers its levels as the form's chips, and saves the level's id", async () => {
    const list = courseList();
    const onAccepted = jest.fn().mockResolvedValue(true);
    renderWithProviders(
      <EditPatternForm
        patterns={[]}
        patternTypes={list.patternTypes}
        modifiers={[]}
        onAccepted={onAccepted}
        onCancel={noop}
      />,
      { lists: [list], patterns: { [list.id]: [] } },
    );

    fireEvent.press(await screen.findByLabelText("Course 2"));
    expect(screen.queryByLabelText("Beginner")).toBeNull();
    fireEvent.changeText(screen.getByPlaceholderText("Figure Name"), "Whip");
    fireEvent.press(screen.getByText("Save"));

    await waitFor(() => expect(onAccepted).toHaveBeenCalled());
    expect(onAccepted.mock.calls[0][0].level).toBe("c2");
  });

  it("shows no level chosen for a figure on a level the list does not have", async () => {
    const list = courseList();
    const figure = createTestPattern(list.patternTypes[0].id, {
      id: 1,
      name: "Old Whip",
      level: "beginner",
    });
    const onAccepted = jest.fn().mockResolvedValue(true);
    renderWithProviders(
      <EditPatternForm
        patterns={[figure]}
        patternTypes={list.patternTypes}
        modifiers={[]}
        onAccepted={onAccepted}
        onCancel={noop}
        existing={figure}
      />,
      { lists: [list], patterns: { [list.id]: [figure] } },
    );

    fireEvent.press(screen.getByRole("button", { name: /Type and level/ }));
    const chip = await screen.findByLabelText("Course 1");
    expect(chip.props.accessibilityState?.selected).toBe(false);
    // Saving leaves the figure's level as it was.
    fireEvent.press(screen.getByText("Save"));
    await waitFor(() => expect(onAccepted).toHaveBeenCalled());
    expect(onAccepted.mock.calls[0][0].level).toBe("beginner");
  });

  it("filters by its levels", async () => {
    const list = courseList();
    const onApplyFilter = jest.fn<void, [PatternFilter]>();
    renderWithProviders(
      <PatternFilterBottomSheet
        visible
        onClose={noop}
        onApplyFilter={onApplyFilter}
        currentFilter={{ name: "", types: [], levels: [], tags: [] }}
        allPatterns={[]}
        patternTypes={list.patternTypes}
      />,
      { lists: [list], patterns: { [list.id]: [] } },
    );

    fireEvent.press(await screen.findByText("Course 3"));
    expect(screen.queryByText("Advanced")).toBeNull();
    fireEvent.press(screen.getByText("Apply"));

    expect(onApplyFilter.mock.calls.at(-1)![0].levels).toEqual(["c3"]);
  });

  it("names a figure's level in its row and sections by the list's order", async () => {
    const list = courseList();
    const type = list.patternTypes[0].id;
    const patterns: IPattern[] = [
      createTestPattern(type, { id: 1, name: "Apple", level: "c3" }),
      createTestPattern(type, { id: 2, name: "Banana", level: "c1" }),
      createTestPattern(type, { id: 3, name: "Cherry", level: "advanced" }),
    ];
    renderWithProviders(
      <PatternList
        patterns={patterns}
        patternTypes={list.patternTypes}
        modifiers={[]}
        onSelect={noop}
        onDelete={noop}
        onAdd={noop}
        onEdit={noop}
      />,
      { lists: [list], patterns: { [list.id]: patterns } },
    );

    expect(await screen.findByText("· Course 3")).toBeOnTheScreen();
    expect(screen.getByText("· Course 1")).toBeOnTheScreen();
    // A level the list does not have shows none, not its id.
    expect(screen.queryByText("· advanced")).toBeNull();
    expect(screen.queryByText("· Advanced")).toBeNull();

    fireEvent.press(screen.getByLabelText("Sort Figures"));
    fireEvent.press(screen.getByText("Level"));
    const headers = screen
      .getAllByRole("header")
      .map((h) => within(h).queryAllByText(/./)[0]?.props.children);
    expect(headers).toEqual(["Course 1", "Course 3", "No level"]);
  });

  it("explains its levels' shading in the Map's legend", async () => {
    const list = courseList();
    renderWithProviders(<Legend patternTypes={list.patternTypes} />, {
      lists: [list],
      patterns: { [list.id]: [] },
    });

    fireEvent.press(screen.getByText("Legend"));
    expect(await screen.findByText("Course 2")).toBeOnTheScreen();
    expect(screen.getByText("Course 1")).toBeOnTheScreen();
    expect(screen.getByText("Course 3")).toBeOnTheScreen();
    expect(screen.queryByText("Intermediate")).toBeNull();
  });

  it("names the level in a figure's details", async () => {
    const list = courseList();
    const figure = createTestPattern(list.patternTypes[0].id, {
      id: 1,
      level: "c2",
    });
    renderWithProviders(
      <PatternDetails
        selectedPattern={figure}
        patterns={[figure]}
        patternTypes={list.patternTypes}
      />,
      { lists: [list], patterns: { [list.id]: [figure] } },
    );

    expect(await screen.findByText("Course 2")).toBeOnTheScreen();
  });

  it("names the level in a reel's caption, from the reel's own list", () => {
    const list = courseList();
    const figure = createTestPattern(list.patternTypes[0].id, {
      id: 1,
      level: "c3",
      videoRefs: [{ type: "local", value: "a.mp4" }],
    });
    const t = i18n.t.bind(i18n);
    const [reel] = collectReels([{ list, patterns: [figure] }]);
    expect(reelMeta(reel, true, t)).toBe(
      `${list.patternTypes[0].slug} · Course 3 · Courses`,
    );
    // The built-in levels when the list has none, and nothing for one it lacks.
    const plain = createTestPatternList({ name: "Plain" });
    const [onBuiltIn] = collectReels([
      {
        list: plain,
        patterns: [
          { ...figure, typeId: plain.patternTypes[0].id, level: "advanced" },
        ],
      },
    ]);
    expect(reelMeta(onBuiltIn, false, t)).toBe(
      `${plain.patternTypes[0].slug} · Advanced`,
    );
    const [lacking] = collectReels([
      {
        list: plain,
        patterns: [{ ...figure, typeId: plain.patternTypes[0].id }],
      },
    ]);
    expect(reelMeta(lacking, false, t)).toBe(plain.patternTypes[0].slug);
  });
});
