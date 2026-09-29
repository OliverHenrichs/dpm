import React from "react";
import {
  seedBinaryFile,
  setDownloadResponse,
} from "@/__mocks__/expo-file-system";
import { llamaCalls, setLlamaAnswer } from "@/__mocks__/llama.rn";
import EditPatternForm from "@/src/pattern/list/EditPatternForm";
import DeviceModelsSection from "@/src/settings/components/DeviceModelsSection";
import { jobStore } from "@/src/deidentify/jobs/jobStore";
import { clearReplacements } from "@/src/deidentify/jobs/replaceVideo";
import {
  IPattern,
  IVideoTranscript,
  NewPattern,
} from "@/src/pattern/types/IPatternList";
import { deleteModels } from "@/src/transcribe/modelStore";
import {
  createTestPattern,
  createTestPatternList,
  createTestPatternType,
} from "@/utils/testFactories";
import {
  fireEvent,
  renderWithProviders,
  screen,
  waitFor,
} from "@/utils/renderWithProviders";

// A stand-in of a few bytes for the 1.3 GB model; the download and hash are real otherwise.
jest.mock("@/src/suggest/models", () => ({
  SUGGESTION_MODEL: {
    id: "llm",
    fileName: "llm.gguf",
    url: "https://models/llm.gguf",
    bytes: 4,
    sha256: "hash-llm",
  },
  SUGGESTION_DOWNLOAD_MB: 1281,
  MIN_DEVICE_MEMORY_BYTES: 6 * 1024 ** 3,
}));
jest.mock("@/modules/audio-extract", () => ({
  isAudioExtractAvailable: true,
  AudioExtractModule: { sha256File: async () => "hash-llm" },
}));
// Android with 8 GB; the gate itself has its own suite.
jest.mock("@/src/suggest/suggestPattern", () => ({
  ...jest.requireActual("@/src/suggest/suggestPattern"),
  canSuggest: () => true,
}));
jest.mock("@/src/transcribe/modelStore", () => ({
  ...jest.requireActual("@/src/transcribe/modelStore"),
  installedModels: () => ({ whisperUri: "w", vadUri: "v" }),
  deleteModels: jest.fn(),
}));
jest.mock("@/src/deidentify/shortenVideo", () => ({
  canShortenVideos: () => true,
  shortenVideo: jest.fn(),
}));

const MODEL_URI = "file:///document/models/llm.gguf";
const SOURCE = "file:///document/video-a.mp4";
const TYPE = createTestPatternType({ slug: "push" });
const TRANSCRIPT: IVideoTranscript = {
  language: "en",
  model: "whisper-base-q5_1",
  createdAt: 1,
  segments: [
    { start: 0, end: 4, text: "This is the sugar push." },
    { start: 4, end: 9, text: "In on one two, out on five six." },
  ],
};
const ANSWER =
  '{"teaches":true,"name":"Sugar Push","description":"In on 1-2, out on 5-6."}';

afterEach(async () => {
  await jobStore.reset();
  clearReplacements();
});

function renderForm(over: Partial<IPattern> = {}) {
  const pattern = createTestPattern(TYPE.id, {
    id: 1,
    name: "",
    description: "",
    videoRefs: [{ type: "local", value: SOURCE, transcript: TRANSCRIPT }],
    ...over,
  });
  const list = createTestPatternList({ patternTypes: [TYPE] });
  const onAccepted = jest.fn<void, [NewPattern | IPattern]>();
  renderWithProviders(
    <EditPatternForm
      patterns={[pattern]}
      patternTypes={[TYPE]}
      modifiers={[]}
      onAccepted={onAccepted}
      onCancel={jest.fn()}
      existing={pattern}
    />,
    { lists: [list], patterns: { [list.id]: [pattern] } },
  );
  return { saved: () => onAccepted.mock.calls.at(-1)![0] };
}

const openSuggestions = async () => {
  fireEvent.press(
    await screen.findByLabelText("Open the transcript of video 1"),
  );
  fireEvent.press(screen.getByText("Suggest name and description"));
};

describe("suggesting a name and description", () => {
  it("asks before the first download, then fills an empty name and the description", async () => {
    setDownloadResponse(() => ({ status: 200, body: Buffer.alloc(4) }));
    setLlamaAnswer(() => ANSWER);
    const { saved } = renderForm();

    await openSuggestions();
    expect(screen.getByText(/one-time download of 1281 MB/)).toBeOnTheScreen();
    expect(llamaCalls.inits).toEqual([]);
    fireEvent.press(screen.getByText("Download and suggest"));

    expect(await screen.findByText("Name: Sugar Push")).toBeOnTheScreen();
    expect(screen.getByText("In on 1-2, out on 5-6.")).toBeOnTheScreen();
    expect(llamaCalls.inits).toEqual([{ model: MODEL_URI }]);
    fireEvent.press(screen.getByText("Use suggestion"));
    fireEvent.press(screen.getByText("Save"));

    await waitFor(() => expect(saved().name).toBe("Sugar Push"));
    expect(saved().description).toBe("In on 1-2, out on 5-6.");
  });

  it("never writes over the user's own text", async () => {
    seedBinaryFile(MODEL_URI, Buffer.alloc(4));
    setLlamaAnswer(() => ANSWER);
    const { saved } = renderForm({
      name: "My push",
      description: "Watch the frame.",
    });

    await openSuggestions();
    fireEvent.press(await screen.findByText("Use suggestion"));
    fireEvent.press(screen.getByText("Save"));

    await waitFor(() => expect(saved().name).toBe("My push"));
    expect(saved().description).toBe(
      "Watch the frame.\n\nIn on 1-2, out on 5-6.",
    );
  });

  it("says so when the video teaches nothing", async () => {
    seedBinaryFile(MODEL_URI, Buffer.alloc(4));
    setLlamaAnswer(
      () => '{"teaches":false,"name":"Open whip","description":"x"}',
    );
    renderForm();

    await openSuggestions();

    expect(
      await screen.findByText(/does not seem to teach a pattern/),
    ).toBeOnTheScreen();
    expect(screen.queryByText("Use suggestion")).toBeNull();
  });

  it("offers another try when the model's answer cannot be read", async () => {
    seedBinaryFile(MODEL_URI, Buffer.alloc(4));
    setLlamaAnswer(() => "Sorry.");
    renderForm();

    await openSuggestions();
    expect(
      await screen.findByText(/No suggestion this time/),
    ).toBeOnTheScreen();

    setLlamaAnswer(() => ANSWER);
    fireEvent.press(screen.getByText("Try again"));
    expect(await screen.findByText("Name: Sugar Push")).toBeOnTheScreen();
  });

  it("reports a failed download", async () => {
    setDownloadResponse(() => ({ status: 500, body: Buffer.alloc(0) }));
    renderForm();

    await openSuggestions();
    fireEvent.press(screen.getByText("Download and suggest"));

    expect(
      await screen.findByText(/No suggestion this time/),
    ).toBeOnTheScreen();
    expect(llamaCalls.inits).toEqual([]);
  });
});

describe("DeviceModelsSection", () => {
  it("lists both models and frees each one's space", () => {
    seedBinaryFile(MODEL_URI, Buffer.alloc(4));
    renderWithProviders(<DeviceModelsSection />);
    expect(screen.getByText("Speech model")).toBeOnTheScreen();
    expect(screen.getByText("Suggestion model")).toBeOnTheScreen();

    fireEvent.press(screen.getByLabelText("Delete Suggestion model"));
    fireEvent.press(screen.getByLabelText("Delete Speech model"));

    expect(deleteModels).toHaveBeenCalled();
    expect(screen.queryByText(/^Delete$/)).toBeNull();
    expect(screen.getAllByText(/^Not downloaded/)).toHaveLength(2);
  });
});
