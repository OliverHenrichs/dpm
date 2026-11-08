import React from "react";
import EditPatternForm from "@/src/pattern/list/EditPatternForm";
import { IModifier } from "@/src/pattern/types/IPatternList";
import {
  createTestPattern,
  createTestPatternType,
} from "@/utils/testFactories";
import {
  fireEvent,
  renderWithProviders,
  screen,
  within,
} from "@/utils/renderWithProviders";

// The attach picker held its rows in a plain view, so modifiers past the sheet's height could
// not be reached. They now sit in a scroller that shrinks to the sheet.

const TYPE = createTestPatternType({ slug: "whip" });
const MODIFIERS: IModifier[] = Array.from({ length: 15 }, (_, i) => ({
  id: `m-${i}`,
  name: `Modifier ${i + 1}`,
  position: "amends",
  universal: false,
  videoRefs: [],
}));

it("lists every unattached modifier in a scrollable list", () => {
  const existing = createTestPattern(TYPE.id, { id: 1, name: "Basic Whip" });
  renderWithProviders(
    <EditPatternForm
      patterns={[existing]}
      patternTypes={[TYPE]}
      modifiers={MODIFIERS}
      onAccepted={jest.fn()}
      onCancel={() => {}}
      existing={existing}
    />,
  );

  fireEvent.press(screen.getByText("Attach..."));

  const list = screen.getByTestId("attach-modifier-list");
  expect(list.type).toBe("RCTScrollView");
  for (const mod of MODIFIERS) {
    expect(within(list).getByText(mod.name)).toBeTruthy();
  }
});
