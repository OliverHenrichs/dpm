import React from "react";
import CycleWarning from "@/src/pattern/graph/CycleWarning";
import { getPalette } from "@/src/common/utils/ColorPalette";
import { renderWithProviders, screen } from "@/utils/renderWithProviders";

const palette = getPalette("light");

const render = (cycles: number[][]) =>
  renderWithProviders(<CycleWarning cycles={cycles} palette={palette} />);

describe("CycleWarning", () => {
  it("says nothing about a healthy graph", () => {
    render([]);

    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("warns when the prerequisites contain a loop", () => {
    render([[1, 2]]);

    expect(screen.getByRole("alert")).toBeOnTheScreen();
    expect(
      screen.getByText(
        "2 patterns are in a prerequisite loop, so their order cannot be shown.",
      ),
    ).toBeOnTheScreen();
  });

  it("counts every pattern across every loop, not the loops", () => {
    // Two separate loops of two and three: the user cares how many patterns
    // are affected, not how many components Tarjan found.
    render([
      [1, 2],
      [7, 8, 9],
    ]);

    expect(screen.getByText(/^5 patterns/)).toBeOnTheScreen();
  });
});
