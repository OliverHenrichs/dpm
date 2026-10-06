import React from "react";
import {
  listFileUris,
  seedBinaryFile,
  setDownloadResponse,
} from "@/__mocks__/expo-file-system";
import { llamaCalls, setLlamaAnswer } from "@/__mocks__/llama.rn";
import EditPatternForm from "@/src/pattern/list/EditPatternForm";
import DeviceModelsSection from "@/src/settings/components/DeviceModelsSection";
import { jobStore } from "@/src/anonymize/jobs/jobStore";
import { clearReplacements } from "@/src/anonymize/jobs/replaceVideo";
import {
  IPattern,
  IVideoTranscript,
  NewPattern,
} from "@/src/pattern/types/IPatternList";
import { deleteModels } from "@/src/transcribe/modelStore";
import { transcribeVideo } from "@/src/transcribe/transcribeVideo";
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
  // Each stand-in model hashes to "hash-<its name>".
  AudioExtractModule: {
    sha256File: async (uri: string) =>
      `hash-${uri.split("/").pop()!.split(".")[0]}`,
  },
}));
// Android with 8 GB; the gate itself has its own suite.
jest.mock("@/src/suggest/suggestPattern", () => ({
  ...jest.requireActual("@/src/suggest/suggestPattern"),
  canSuggest: () => true,
}));
// Stand-ins of a few bytes for the speech models, so Settings can find them on the "phone".
jest.mock("@/src/transcribe/models", () => {
  const spec = (id: string, bytes: number) => ({
    id,
    fileName: `${id}.bin`,
    url: `https://models/${id}.bin`,
    bytes,
    sha256: `hash-${id}`,
  });
  const WHISPER_MODEL = spec("whisper", 6);
  const VAD_MODEL = spec("vad", 2);
  return {
    ...jest.requireActual("@/src/transcribe/models"),
    WHISPER_MODEL,
    VAD_MODEL,
    WHISPER_ACCURATE_MODEL: spec("small", 3),
    TRANSCRIPTION_MODELS: [WHISPER_MODEL, VAD_MODEL],
  };
});
jest.mock("@/src/transcribe/modelStore", () => ({
  ...jest.requireActual("@/src/transcribe/modelStore"),
  installedModels: () => ({
    whisperUri: "w",
    vadUri: "v",
    whisperModelId: "whisper-base-q5_1",
  }),
  deleteModels: jest.fn(),
}));
// The engine has its own suite; here a transcription only needs its outcome.
jest.mock("@/src/transcribe/transcribeVideo", () => ({
  ...jest.requireActual("@/src/transcribe/transcribeVideo"),
  transcribeVideo: jest.fn(),
}));
jest.mock("@/src/anonymize/shortenVideo", () => ({
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
  fireEvent.press(screen.getByText("Suggest name and description with AI"));
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
    // In the sheet, with another try, and on the form's line for the job.
    expect(
      await screen.findAllByText(
        /^No suggestion: the AI gave no usable answer/,
      ),
    ).toHaveLength(2);
    expect(screen.getByText("Try again")).toBeOnTheScreen();

    setLlamaAnswer(() => ANSWER);
    fireEvent.press(screen.getByText("Try again"));
    expect(await screen.findByText("Name: Sugar Push")).toBeOnTheScreen();
  });

  it("reports a failed download", async () => {
    setDownloadResponse(() => ({ status: 500, body: Buffer.alloc(0) }));
    renderForm();

    await openSuggestions();
    fireEvent.press(screen.getByText("Download and suggest"));

    // In the sheet, with another try, and on the form's line for the job.
    expect(
      await screen.findAllByText(
        /^No suggestion: the AI model could not be downloaded/,
      ),
    ).toHaveLength(2);
    expect(screen.getByText("Try again")).toBeOnTheScreen();
    expect(llamaCalls.inits).toEqual([]);
  });

  it("keeps going when the transcript is closed, and waits below the videos", async () => {
    seedBinaryFile(MODEL_URI, Buffer.alloc(4));
    setLlamaAnswer(() => ANSWER);
    let finishBefore: () => void = () => undefined;
    // Video work queued first holds the suggestion back, so it can be seen waiting.
    void jobStore.runExclusive(
      () => new Promise<void>((resolve) => (finishBefore = resolve)),
    );
    const { saved } = renderForm();

    await openSuggestions();
    expect(
      await screen.findByText("Waiting for the video work to finish …"),
    ).toBeOnTheScreen();
    expect(screen.getByText(/You can close the transcript/)).toBeOnTheScreen();
    fireEvent.press(screen.getByLabelText("Close"));
    expect(
      screen.getByText("Waiting to suggest a name and description"),
    ).toBeOnTheScreen();

    finishBefore();
    fireEvent.press(await screen.findByText("Review"));
    expect(await screen.findByText("Name: Sugar Push")).toBeOnTheScreen();
    fireEvent.press(screen.getByText("Use suggestion"));
    await waitFor(() => expect(jobStore.getJobs()[0].status).toBe("done"));
    fireEvent.press(screen.getByText("Save"));

    await waitFor(() => expect(saved().name).toBe("Sugar Push"));
  });

  it("says that it uses AI, and that copying lines does not", async () => {
    renderForm();
    fireEvent.press(
      await screen.findByLabelText("Open the transcript of video 1"),
    );
    expect(screen.getByText(/An AI model on this phone/)).toBeOnTheScreen();
    expect(
      screen.getByText(/copy them word for word into the description/),
    ).toBeOnTheScreen();
  });
});

describe("transcribing and suggesting in one job", () => {
  it("transcribes, suggests, and waits for the suggestion to be used", async () => {
    seedBinaryFile(MODEL_URI, Buffer.alloc(4));
    setLlamaAnswer(() => ANSWER);
    (transcribeVideo as jest.Mock).mockReturnValue({
      promise: Promise.resolve({
        transcript: TRANSCRIPT,
        timing: {
          audioSeconds: 9,
          speechSeconds: 9,
          regions: 1,
          extractMs: 1,
          transcribeMs: 1,
        },
      }),
      stop: jest.fn(),
    });
    const { saved } = renderForm({
      videoRefs: [{ type: "local", value: SOURCE }],
    });

    fireEvent.press(await screen.findByLabelText("Edit a video"));
    fireEvent.press(await screen.findByRole("tab", { name: "Speech" }));
    // On by default: the suggestion model is already on the phone.
    expect(
      await screen.findByText("Then suggest a name and description"),
    ).toBeOnTheScreen();
    fireEvent.press(screen.getByText("Transcribe speech"));

    expect(
      await screen.findByText("A name and description are suggested"),
    ).toBeOnTheScreen();
    fireEvent.press(screen.getByText("Review"));
    expect(await screen.findByText("Name: Sugar Push")).toBeOnTheScreen();
    fireEvent.press(screen.getByText("Use suggestion"));
    await waitFor(() => expect(jobStore.getJobs()[0].status).toBe("done"));
    fireEvent.press(screen.getByText("Save"));

    await waitFor(() => expect(saved().name).toBe("Sugar Push"));
    expect(saved().description).toBe("In on 1-2, out on 5-6.");
    expect(saved().videoRefs[0].transcript).toEqual(TRANSCRIPT);
  });

  it("keeps the transcript when the suggestion fails, and says so on review", async () => {
    seedBinaryFile(MODEL_URI, Buffer.alloc(4));
    setLlamaAnswer(() => "Sorry.");
    (transcribeVideo as jest.Mock).mockReturnValue({
      promise: Promise.resolve({
        transcript: TRANSCRIPT,
        timing: {
          audioSeconds: 9,
          speechSeconds: 9,
          regions: 1,
          extractMs: 1,
          transcribeMs: 1,
        },
      }),
      stop: jest.fn(),
    });
    const { saved } = renderForm({
      videoRefs: [{ type: "local", value: SOURCE }],
    });

    fireEvent.press(await screen.findByLabelText("Edit a video"));
    fireEvent.press(await screen.findByRole("tab", { name: "Speech" }));
    fireEvent.press(await screen.findByText("Transcribe speech"));
    fireEvent.press(await screen.findByText("Review"));

    expect(
      await screen.findByText(/No suggestion this time/),
    ).toBeOnTheScreen();
    expect(screen.queryByText("Use suggestion")).toBeNull();
    fireEvent.press(screen.getByText("Discard"));
    await waitFor(() => expect(jobStore.getJobs()[0].status).toBe("done"));
    fireEvent.press(screen.getByText("Save"));
    await waitFor(() =>
      expect(saved().videoRefs[0].transcript).toEqual(TRANSCRIPT),
    );
    expect(saved().name).toBe("");
  });

  it("is off until the suggestion model is on the phone, and names its size", async () => {
    renderForm({ videoRefs: [{ type: "local", value: SOURCE }] });

    fireEvent.press(await screen.findByLabelText("Edit a video"));
    fireEvent.press(await screen.findByRole("tab", { name: "Speech" }));

    const option = screen.getByRole("switch", {
      name: "Then suggest a name and description",
    });
    expect(option).not.toBeChecked();
    expect(screen.getByText(/Downloads 1281 MB once\.$/)).toBeOnTheScreen();
  });
});

describe("DeviceModelsSection", () => {
  it("downloads a model ahead of its first use", async () => {
    setDownloadResponse(() => ({ status: 200, body: Buffer.alloc(4) }));
    renderWithProviders(<DeviceModelsSection />);

    fireEvent.press(screen.getByLabelText("Download Suggestion model"));

    expect(
      await screen.findByLabelText("Delete Suggestion model"),
    ).toBeOnTheScreen();
  });

  it("says so when a download fails, and offers it again", async () => {
    setDownloadResponse(() => ({ status: 500, body: Buffer.alloc(0) }));
    renderWithProviders(<DeviceModelsSection />);

    fireEvent.press(screen.getByLabelText("Download Suggestion model"));

    expect(await screen.findByText(/^Download failed/)).toBeOnTheScreen();
    expect(
      screen.getByLabelText("Download Suggestion model"),
    ).toBeOnTheScreen();
  });

  it("lists the models and frees each one's space", () => {
    seedBinaryFile(MODEL_URI, Buffer.alloc(4));
    seedBinaryFile("file:///document/models/whisper.bin", Buffer.alloc(6));
    seedBinaryFile("file:///document/models/vad.bin", Buffer.alloc(2));
    seedBinaryFile("file:///document/models/small.bin", Buffer.alloc(3));
    renderWithProviders(<DeviceModelsSection />);
    expect(screen.getByText("Speech model")).toBeOnTheScreen();
    expect(screen.getByText("Accurate speech model")).toBeOnTheScreen();
    expect(screen.getByText("Suggestion model")).toBeOnTheScreen();

    fireEvent.press(screen.getByLabelText("Delete Suggestion model"));
    fireEvent.press(screen.getByLabelText("Delete Speech model"));
    fireEvent.press(screen.getByLabelText("Delete Accurate speech model"));

    expect(deleteModels).toHaveBeenCalled();
    expect(screen.queryByText(/^Delete$/)).toBeNull();
    expect(screen.getAllByText(/^Not downloaded/)).toHaveLength(3);
    // Deleting the accurate model leaves the standard ones alone.
    expect(listFileUris()).not.toContain("file:///document/models/small.bin");
    expect(listFileUris()).toContain("file:///document/models/vad.bin");
  });

  it("downloads the accurate model with the voice detector it needs", async () => {
    const fetched: string[] = [];
    setDownloadResponse((url) => {
      fetched.push(url);
      return {
        status: 200,
        body: Buffer.alloc(url.endsWith("small.bin") ? 3 : 2),
      };
    });
    renderWithProviders(<DeviceModelsSection />);

    fireEvent.press(screen.getByLabelText("Download Accurate speech model"));

    expect(
      await screen.findByLabelText("Delete Accurate speech model"),
    ).toBeOnTheScreen();
    expect(fetched).toEqual([
      "https://models/small.bin",
      "https://models/vad.bin",
    ]);
  });
});
