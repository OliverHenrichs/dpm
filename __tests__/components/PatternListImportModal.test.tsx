import React from "react";
import PatternListImportModal, {
  ImportDecision,
} from "@/src/pattern/data/components/PatternListImportModal";
import { PatternListWithPatterns } from "@/src/pattern/data/types/IExportData";
import { IPatternList } from "@/src/pattern/types/IPatternList";
import { createTestPatternList } from "@/utils/testFactories";
import {
  fireEvent,
  renderWithProviders,
  screen,
} from "@/utils/renderWithProviders";

const importable = (
  overrides: Partial<PatternListWithPatterns> = {},
): PatternListWithPatterns => ({
  ...createTestPatternList(),
  patterns: [],
  ...overrides,
});

function renderModal(
  importedLists: PatternListWithPatterns[],
  existingLists: IPatternList[],
) {
  const onImport = jest.fn<void, [ImportDecision[]]>();
  renderWithProviders(
    <PatternListImportModal
      visible
      importedLists={importedLists}
      existingLists={existingLists}
      onImport={onImport}
      onCancel={jest.fn()}
    />,
    { activeListId: null },
  );
  const importNow = () => {
    fireEvent.press(screen.getByText("Import"));
    return onImport.mock.calls[0][0];
  };
  return { importNow };
}

const COPY_NAME = "Imported as a new list beside yours, named:";
const CLASH_NAME =
  "A list with this name is already on this phone. Keep the name or rename it:";

describe("PatternListImportModal", () => {
  it("offers a copy beside skip and replace for a list already here, skipping by default", () => {
    const existing = createTestPatternList({ name: "Salsa" });
    const { importNow } = renderModal(
      [importable({ id: existing.id, name: "Salsa" })],
      [existing],
    );

    expect(screen.getByRole("radio", { name: "Skip" })).toBeSelected();
    expect(screen.getByRole("radio", { name: "Copy" })).toBeOnTheScreen();
    expect(screen.queryByLabelText(COPY_NAME)).toBeNull();
    expect(importNow()[0].action).toBe("skip");
  });

  it("imports a copy under the suggested name, or the one typed", () => {
    const existing = createTestPatternList({ name: "Salsa" });
    const { importNow } = renderModal(
      [importable({ id: existing.id, name: "Salsa" })],
      [existing],
    );

    fireEvent.press(screen.getByRole("radio", { name: "Copy" }));
    expect(screen.getByLabelText(COPY_NAME).props.value).toBe("Salsa (2)");
    fireEvent.changeText(screen.getByLabelText(COPY_NAME), "Salsa from Ana");

    expect(importNow()[0]).toMatchObject({
      action: "copy",
      name: "Salsa from Ana",
    });
  });

  it("lets a new list whose name is taken be renamed, keeping the name by default", () => {
    const { importNow } = renderModal(
      [importable({ name: "Salsa" })],
      [createTestPatternList({ name: "Salsa" })],
    );

    expect(screen.getByText("New List")).toBeOnTheScreen();
    expect(screen.getByLabelText(CLASH_NAME).props.value).toBe("Salsa");
    expect(importNow()[0]).toMatchObject({ action: "replace", name: "Salsa" });
  });

  it("asks nothing about the name of a new list nobody shares", () => {
    renderModal([importable({ name: "Zouk" })], [createTestPatternList()]);

    expect(screen.queryByLabelText(CLASH_NAME)).toBeNull();
  });
});
