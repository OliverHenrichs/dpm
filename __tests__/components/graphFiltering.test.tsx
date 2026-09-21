import React from "react";
import PatternGraphScreen from "@/src/pattern/graph/PatternGraphScreen";
import { IPattern, IPatternList } from "@/src/pattern/types/IPatternList";
import {
  createTestPattern,
  createTestPatternList,
  createTestPatternType,
} from "@/utils/testFactories";
import {
  fireEvent,
  renderWithProviders,
  screen,
} from "@/utils/renderWithProviders";

const TYPE = createTestPatternType({ slug: "push" });

const pattern = (id: number, name: string, prerequisites: number[] = []) =>
  createTestPattern(TYPE.id, { id, name, prerequisites });

const PATTERNS = [
  pattern(1, "Sugar Push"),
  pattern(2, "Whip", [1]),
  pattern(3, "Basket Whip", [2]),
];

/**
 * The graph itself is SVG, which the test renderer does not descend into — so
 * these assert on the chrome around it: the filter affordance, the summary
 * that says what the filter did, and the empty state. What the filter selects
 * is covered against the model in useGraphFilter and filterGraphModel.
 */
async function renderGraph(patterns: IPattern[] = PATTERNS) {
  const list: IPatternList = createTestPatternList({ patternTypes: [TYPE] });
  renderWithProviders(<PatternGraphScreen />, {
    lists: [list],
    patterns: { [list.id]: patterns },
  });
  await screen.findByLabelText("Filter Patterns");
  return { list };
}

const applyNameFilter = async (name: string) => {
  fireEvent.press(screen.getByLabelText("Filter Patterns"));
  const input = await screen.findByPlaceholderText("Search by name...");
  fireEvent.changeText(input, name);
  fireEvent.press(screen.getByText("Apply"));
};

describe("filtering the graph", () => {
  describe("the filter affordance", () => {
    it("is offered in the graph header", async () => {
      await renderGraph();

      expect(screen.getByLabelText("Filter Patterns")).toBeOnTheScreen();
    });

    it("opens the shared filter sheet", async () => {
      await renderGraph();

      fireEvent.press(screen.getByLabelText("Filter Patterns"));

      expect(
        await screen.findByPlaceholderText("Search by name..."),
      ).toBeOnTheScreen();
    });

    it("offers the chain modes, and no fourth one", async () => {
      await renderGraph();

      fireEvent.press(screen.getByLabelText("Filter Patterns"));

      expect(await screen.findByText("Matches only")).toBeOnTheScreen();
      expect(screen.getByText("Path to")).toBeOnTheScreen();
      expect(screen.getByText("Everything connected")).toBeOnTheScreen();
    });

    it("starts on the path-to mode", async () => {
      await renderGraph();

      fireEvent.press(screen.getByLabelText("Filter Patterns"));

      expect(
        await screen.findByRole("button", { name: "Path to", selected: true }),
      ).toBeOnTheScreen();
    });
  });

  describe("the summary", () => {
    it("says nothing until a filter is applied", async () => {
      await renderGraph();

      expect(screen.queryByLabelText("Clear filter")).toBeNull();
    });

    it("separates what matched from what is shown", async () => {
      await renderGraph();

      await applyNameFilter("Basket");

      // Basket Whip matched; Sugar Push and Whip are the path to it.
      expect(
        await screen.findByText("1 matched · 3 shown of 3"),
      ).toBeOnTheScreen();
    });

    it("follows the chain mode", async () => {
      await renderGraph();

      fireEvent.press(screen.getByLabelText("Filter Patterns"));
      fireEvent.press(await screen.findByLabelText("Matches only"));
      fireEvent.changeText(
        screen.getByPlaceholderText("Search by name..."),
        "Basket",
      );
      fireEvent.press(screen.getByText("Apply"));

      expect(
        await screen.findByText("1 matched · 1 shown of 3"),
      ).toBeOnTheScreen();
    });

    it("clears the filter from the summary", async () => {
      await renderGraph();
      await applyNameFilter("Basket");
      await screen.findByLabelText("Clear filter");

      fireEvent.press(screen.getByLabelText("Clear filter"));

      expect(screen.queryByLabelText("Clear filter")).toBeNull();
    });
  });

  describe("resetting the layout", () => {
    it("is not offered until something has been moved", async () => {
      await renderGraph();

      expect(screen.queryByLabelText("Reset layout")).toBeNull();
    });
  });

  describe("empty states", () => {
    it("distinguishes an empty list from a filter that matched nothing", async () => {
      await renderGraph();

      await applyNameFilter("Tuck Turn");

      expect(
        await screen.findByText("No patterns match this filter"),
      ).toBeOnTheScreen();
    });

    it("keeps the list-is-empty copy when no filter is set", async () => {
      await renderGraph([]);

      expect(
        screen.getByText(
          "No patterns to visualize. Add patterns in the Patterns tab.",
        ),
      ).toBeOnTheScreen();
    });
  });
});
