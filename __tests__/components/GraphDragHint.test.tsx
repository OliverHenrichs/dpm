import React from "react";
import GraphDragHint from "@/src/pattern/graph/components/GraphDragHint";
import { dismissDragHint } from "@/src/pattern/graph/data/GraphHintStorage";
import { getPalette } from "@/src/common/utils/ColorPalette";
import {
  fireEvent,
  renderWithProviders,
  screen,
} from "@/utils/renderWithProviders";

const palette = getPalette("light");

const HINT = "Hold a pattern for a moment, then drag to move it.";

const renderHint = (visible = true) =>
  renderWithProviders(<GraphDragHint visible={visible} palette={palette} />);

/**
 * Long-press-then-drag has no affordance: a node looks the same whether or
 * not it can be picked up. Without this the feature is invisible, which is
 * exactly how it was first reported.
 */
describe("GraphDragHint", () => {
  it("tells the user how to move a pattern", async () => {
    renderHint();

    expect(await screen.findByText(HINT)).toBeOnTheScreen();
  });

  it("says nothing on a view that cannot be rearranged", () => {
    renderHint(false);

    expect(screen.queryByText(HINT)).toBeNull();
  });

  it("goes away when dismissed", async () => {
    renderHint();
    await screen.findByText(HINT);

    fireEvent.press(screen.getByLabelText("Dismiss hint"));

    expect(screen.queryByText(HINT)).toBeNull();
  });

  it("stays away on the next visit", async () => {
    await dismissDragHint();

    renderHint();

    // Nothing to wait for, so give the stored state a chance to arrive and
    // assert it never appears.
    await Promise.resolve();
    expect(screen.queryByText(HINT)).toBeNull();
  });
});
