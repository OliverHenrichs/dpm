import React from "react";
import AnonymizeModal, {
  AnonymizeTarget,
} from "@/src/anonymize/components/AnonymizeModal";
import { jobStore, StartJob } from "@/src/anonymize/jobs/jobStore";
import { installedModels } from "@/src/transcribe/modelStore";
import { createTestPatternList } from "@/utils/testFactories";
import {
  fireEvent,
  renderWithProviders,
  screen,
} from "@/utils/renderWithProviders";

// Sound can be read here, as on an Android phone.
jest.mock("@/modules/audio-extract", () => ({
  isAudioExtractAvailable: true,
  AudioExtractModule: {},
}));
jest.mock("@/src/transcribe/modelStore", () => ({
  ...jest.requireActual("@/src/transcribe/modelStore"),
  installedModels: jest.fn(),
}));
// No native pipeline under jest: no provider, so the panel offers shortening only.
jest.mock("@/src/anonymize/providers/allProviders", () => ({
  ALL_PROVIDERS: [],
}));
// The real panel needs expo-video; this one offers the cut as a plain button and shows the
// options it is given for it.
jest.mock("@/src/anonymize/components/VideoEditPanel", () => ({
  __esModule: true,
  default: ({
    sourceUri,
    onShorten,
    cutOptions,
  }: {
    sourceUri: string;
    onShorten: (r: object) => void;
    cutOptions?: (cut: "shorten" | "anonymize") => React.ReactNode;
  }) => {
    const { Text: MockText } = jest.requireActual("react-native");
    return (
      <>
        {cutOptions?.("shorten")}
        <MockText
          onPress={() =>
            onShorten({ sourceUri, startSeconds: 1, endSeconds: 4 })
          }
        >
          mock shorten
        </MockText>
      </>
    );
  },
}));

const mockedInstalled = installedModels as jest.MockedFunction<
  typeof installedModels
>;
const SOURCE = "file:///document/video-a.mp4";

function renderModal(extra: Partial<AnonymizeTarget> = {}) {
  const list = createTestPatternList();
  const started: StartJob[] = [];
  jest.spyOn(jobStore, "start").mockImplementation((job) => {
    started.push(job);
    return `job-${started.length}`;
  });
  renderWithProviders(
    <AnonymizeModal
      target={{
        listId: list.id,
        patternName: "Whip",
        sourceUri: SOURCE,
        ...extra,
      }}
      onClose={jest.fn()}
    />,
    { lists: [list] },
  );
  return { kinds: () => started.map((j) => j.kind) };
}

beforeEach(() => {
  mockedInstalled.mockReturnValue({
    whisperUri: "w",
    vadUri: "v",
    whisperModelId: "whisper-base-q5_1",
  });
});
afterEach(() => jest.restoreAllMocks());

describe("Edit video — transcribing the full video first", () => {
  it("is on by default, and queues the transcription ahead of the cut", async () => {
    const { kinds } = renderModal();

    expect(
      await screen.findByText("Transcribe the whole video first"),
    ).toBeOnTheScreen();
    fireEvent.press(screen.getByText("mock shorten"));

    expect(kinds()).toEqual(["transcribe", "shorten"]);
  });

  it("only cuts once it is switched off", async () => {
    const { kinds } = renderModal();

    fireEvent.press(
      await screen.findByText("Transcribe the whole video first"),
    );
    fireEvent.press(screen.getByText("mock shorten"));

    expect(kinds()).toEqual(["shorten"]);
  });

  it("names no download once the speech model is on the phone", async () => {
    renderModal();

    await screen.findByText("Transcribe the whole video first");
    expect(screen.queryByText(/Downloads/)).toBeNull();
  });

  it("names the download when the speech model is not on the phone yet", async () => {
    mockedInstalled.mockReturnValue(null);
    renderModal();

    expect(
      await screen.findByText(/Downloads 61 MB once\.$/),
    ).toBeOnTheScreen();
  });

  it("is not offered for a video that already has a transcript", async () => {
    const transcript = {
      language: "en",
      model: "m",
      createdAt: 1,
      segments: [],
    };
    renderModal({ transcript });
    await screen.findByText("mock shorten");
    expect(screen.queryByText(/Transcribe the whole video first/)).toBeNull();
  });
});
