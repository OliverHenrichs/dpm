import React from "react";
import { Circle, Path } from "react-native-svg";
import Legend from "@/src/pattern/graph/Legend";
import { getPalette } from "@/src/common/utils/ColorPalette";
import { createTestPatternType } from "@/utils/testFactories";
import {
  fireEvent,
  renderWithProviders,
  screen,
} from "@/utils/renderWithProviders";

const palette = getPalette("light");
const TYPES = [
  createTestPatternType({ slug: "push", color: "#FF0000" }),
  createTestPatternType({ slug: "pass", color: "#00FF00" }),
];

const renderLegend = (patternTypes = TYPES) =>
  renderWithProviders(<Legend palette={palette} patternTypes={patternTypes} />);

const expand = () => fireEvent.press(screen.getByText("Legend"));

describe("Legend", () => {
  describe("collapsed", () => {
    it("is out of the way until asked for", () => {
      renderLegend();

      expect(screen.queryByText("Type Colors:")).toBeNull();
    });

    it("opens on a press", () => {
      renderLegend();

      expand();

      expect(screen.getByText("Type Colors:")).toBeOnTheScreen();
    });

    it("closes again", () => {
      renderLegend();
      expand();

      fireEvent.press(screen.getByText("Hide"));

      expect(screen.queryByText("Type Colors:")).toBeNull();
    });
  });

  describe("what it explains", () => {
    it("names every pattern type in the list", () => {
      renderLegend();
      expand();

      expect(screen.getByText("push lane")).toBeOnTheScreen();
      expect(screen.getByText("pass lane")).toBeOnTheScreen();
    });

    it("explains the level shading", () => {
      renderLegend();
      expand();

      expect(screen.getByText("Level Shading:")).toBeOnTheScreen();
    });

    it("explains what a foundational pattern is", () => {
      renderLegend();
      expand();

      expect(screen.getByText("Foundational Pattern")).toBeOnTheScreen();
    });

    /**
     * The badges have no words on them, so the legend is the only place that
     * says what they mean — and it draws the same shapes rather than emoji,
     * so it matches the graph whatever fonts the device has.
     */
    it("explains the video badge, with the same glyph the node draws", () => {
      renderLegend();
      expand();

      expect(screen.getByText("Has video")).toBeOnTheScreen();
      expect(screen.UNSAFE_getAllByType(Path).length).toBeGreaterThan(0);
    });

    it("explains the modifier badge, with the same dots", () => {
      renderLegend();
      expand();

      expect(screen.getByText("Modifiers attached")).toBeOnTheScreen();
      expect(screen.UNSAFE_getAllByType(Circle)).toHaveLength(3);
    });

    it("says how to move a pattern", () => {
      renderLegend();
      expand();

      expect(screen.getByText("Hold and drag to move")).toBeOnTheScreen();
    });
  });

  describe("edge cases", () => {
    it("copes with a list that has no types", () => {
      renderLegend([]);
      expand();

      expect(screen.getByText("Type Colors:")).toBeOnTheScreen();
    });
  });
});
