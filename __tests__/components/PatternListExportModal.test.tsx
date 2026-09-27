import React from "react";
import PatternListExportModal from "@/src/pattern/data/components/PatternListExportModal";
import { PatternListWithPatterns } from "@/src/pattern/data/types/IExportData";
import {
  createTestPattern,
  createTestPatternList,
} from "@/utils/testFactories";
import {
  fireEvent,
  renderWithProviders,
  screen,
} from "@/utils/renderWithProviders";

const TRANSCRIPT = {
  language: "en",
  model: "whisper-base-q5_1",
  createdAt: 1,
  segments: [{ start: 0, end: 2, text: "Anchor on five." }],
};

const list = (name: string, transcribed: boolean): PatternListWithPatterns => ({
  ...createTestPatternList({ name }),
  patterns: [
    createTestPattern("t", {
      id: 1,
      videoRefs: [
        {
          type: "local",
          value: "/v.mp4",
          ...(transcribed && { transcript: TRANSCRIPT }),
        },
      ],
    }),
  ],
});

function renderModal(lists: PatternListWithPatterns[]) {
  const onExport = jest.fn();
  renderWithProviders(
    <PatternListExportModal
      visible
      patternLists={lists}
      onExport={onExport}
      onCancel={jest.fn()}
    />,
  );
  const exportButton = () => screen.getByText(/^Export \(/);
  return { onExport, exportButton };
}

const transcriptSwitch = () => screen.getByLabelText("Include transcripts");

describe("PatternListExportModal — transcripts (L4)", () => {
  it("does not offer transcripts when there are none", () => {
    renderModal([list("Plain", false)]);
    expect(screen.queryByText("Include transcripts")).toBeNull();
  });

  it("leaves them out unless switched on", () => {
    const { onExport, exportButton } = renderModal([list("Taught", true)]);

    fireEvent.press(exportButton());

    expect(onExport).toHaveBeenCalledWith(expect.any(Array), {
      includeVideos: true,
      exportAsReadonly: false,
      includeTranscripts: false,
    });
  });

  it("includes them when the user chooses to", () => {
    const { onExport, exportButton } = renderModal([list("Taught", true)]);

    fireEvent(transcriptSwitch(), "valueChange", true);
    fireEvent.press(exportButton());

    expect(onExport.mock.calls[0][1].includeTranscripts).toBe(true);
  });

  it("cannot include them without the videos they belong to", () => {
    const { onExport, exportButton } = renderModal([list("Taught", true)]);
    fireEvent(transcriptSwitch(), "valueChange", true);

    fireEvent(screen.getAllByRole("switch")[0], "valueChange", false);

    expect(transcriptSwitch().props.disabled).toBe(true);
    expect(
      screen.getByText(/Transcripts travel with their videos/),
    ).toBeOnTheScreen();
    fireEvent.press(exportButton());
    expect(onExport.mock.calls[0][1]).toMatchObject({
      includeVideos: false,
      includeTranscripts: false,
    });
  });

  it("offers them only for the lists being exported", () => {
    renderModal([list("Plain", false), list("Taught", true)]);
    expect(screen.getByText("Include transcripts")).toBeOnTheScreen();

    fireEvent.press(screen.getByText("Taught"));

    expect(screen.queryByText("Include transcripts")).toBeNull();
  });
});

describe("PatternListExportModal — opening", () => {
  it("selects every list, even when the lists arrived after it was first mounted", () => {
    // Settings mounts it hidden before the lists have loaded, then shows it.
    const props = { onExport: jest.fn(), onCancel: jest.fn() };
    const { rerender } = renderWithProviders(
      <PatternListExportModal visible={false} patternLists={[]} {...props} />,
    );
    const lists = [list("Tango", false), list("Swing", false)];

    rerender(
      <PatternListExportModal visible patternLists={lists} {...props} />,
    );

    expect(screen.getByText("Export (2)")).toBeOnTheScreen();
  });
});
