import React from "react";
import { useVideoPlayer } from "expo-video";
import { seedBinaryFile } from "@/__mocks__/expo-file-system";
import EditPatternForm from "@/src/pattern/list/EditPatternForm";
import TranscriptSheet, {
  TranscriptTarget,
} from "@/src/transcribe/components/TranscriptSheet";
import AnonymizeJobsBanner from "@/src/anonymize/components/AnonymizeJobsBanner";
import { jobStore } from "@/src/anonymize/jobs/jobStore";
import {
  applyReplacements,
  clearReplacements,
  recordReplacement,
} from "@/src/anonymize/jobs/replaceVideo";
import { withTranscript } from "@/src/pattern/data/transcripts";
import {
  IPattern,
  IVideoTranscript,
  NewPattern,
} from "@/src/pattern/types/IPatternList";
import { installedModels } from "@/src/transcribe/modelStore";
import { transcribeVideo } from "@/src/transcribe/transcribeVideo";
import {
  createTestPattern,
  createTestPatternList,
  createTestPatternType,
} from "@/utils/testFactories";
import {
  act,
  fireEvent,
  renderWithProviders,
  screen,
  waitFor,
} from "@/utils/renderWithProviders";

// The native side is absent under jest; say it is there, so the speech actions show.
jest.mock("@/modules/audio-extract", () => ({
  isAudioExtractAvailable: true,
  AudioExtractModule: {},
}));
jest.mock("@/src/transcribe/modelStore", () => ({
  ...jest.requireActual("@/src/transcribe/modelStore"),
  installedModels: jest.fn(),
  ensureModels: jest.fn(async () => ({
    whisperUri: "w",
    vadUri: "v",
    whisperModelId: "whisper-base-q5_1",
  })),
  deleteModels: jest.fn(),
}));
jest.mock("@/src/transcribe/transcribeVideo", () => ({
  ...jest.requireActual("@/src/transcribe/transcribeVideo"),
  transcribeVideo: jest.fn(),
}));
// Editing needs the shortening module; the trim step itself is not under test here.
jest.mock("@/src/anonymize/shortenVideo", () => ({
  canShortenVideos: () => true,
  shortenVideo: jest.fn(),
}));
jest.mock("@/src/anonymize/providers/allProviders", () => ({
  ALL_PROVIDERS: [],
}));

const mockedInstalled = installedModels as jest.MockedFunction<
  typeof installedModels
>;
const mockedTranscribe = transcribeVideo as jest.MockedFunction<
  typeof transcribeVideo
>;

const TRANSCRIPT: IVideoTranscript = {
  language: "en",
  model: "whisper-base-q5_1",
  createdAt: 1,
  segments: [
    { start: 0.5, end: 3, text: "Anchor on five and six." },
    { start: 3, end: 6, text: "Keep the frame." },
    { start: 12, end: 15, text: "Then the whip." },
  ],
};
const TIMING = {
  audioSeconds: 15,
  speechSeconds: 10,
  regions: 2,
  extractMs: 1,
  transcribeMs: 1,
};
const SOURCE = "file:///document/video-a.mp4";
const TYPE = createTestPatternType({ slug: "push" });

beforeEach(() => {
  mockedInstalled.mockReturnValue({
    whisperUri: "w",
    vadUri: "v",
    whisperModelId: "whisper-base-q5_1",
  });
  seedBinaryFile(SOURCE, Buffer.from([1]));
});
afterEach(async () => {
  await jobStore.reset();
  clearReplacements();
});

const target = (over: Partial<TranscriptTarget> = {}): TranscriptTarget => ({
  listId: "l",
  patternName: "Sugar Push",
  sourceUri: SOURCE,
  transcript: TRANSCRIPT,
  hasSound: true,
  ...over,
});

describe("TranscriptSheet", () => {
  it("plays the video from a line when it is tapped", () => {
    renderWithProviders(
      <TranscriptSheet target={target()} onClose={jest.fn()} />,
    );
    const player = (useVideoPlayer as jest.Mock).mock.results.at(-1)!.value;

    fireEvent.press(screen.getByLabelText("Play from 0:12"));

    expect(player.seekBy).toHaveBeenCalledWith(12);
    expect(player.play).toHaveBeenCalled();
  });

  it("adds only the ticked lines to the description, in spoken order", () => {
    const onDescriptionChange = jest.fn();
    const onClose = jest.fn();
    renderWithProviders(
      <TranscriptSheet
        target={target()}
        onClose={onClose}
        onDescriptionChange={onDescriptionChange}
      />,
    );
    const add = () => screen.getByText(/^Copy selected lines to description/);
    expect(add()).toHaveTextContent("Copy selected lines to description (0)");

    fireEvent.press(screen.getByLabelText("Select the line at 0:12"));
    fireEvent.press(screen.getByLabelText("Select the line at 0:00"));
    fireEvent.press(add());

    const [append] = onDescriptionChange.mock.calls[0];
    expect(append("My notes.")).toBe(
      "My notes.\n\nAnchor on five and six. Then the whip.",
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("transcribes again in the language the user picks", () => {
    const onRetranscribe = jest.fn();
    renderWithProviders(
      <TranscriptSheet
        target={target()}
        onClose={jest.fn()}
        onRetranscribe={onRetranscribe}
      />,
    );
    expect(screen.getByText("Language: English")).toBeOnTheScreen();

    fireEvent.press(screen.getByText("Wrong language?"));
    fireEvent.press(screen.getByText("Deutsch"));

    expect(onRetranscribe).toHaveBeenCalledWith("de");
  });

  it("offers no re-run for a video without sound", () => {
    renderWithProviders(
      <TranscriptSheet
        target={target({ hasSound: false })}
        onClose={jest.fn()}
        onRetranscribe={jest.fn()}
      />,
    );
    expect(screen.queryByText("Wrong language?")).toBeNull();
  });

  it("corrects a line by hand, and unticks lines when one is removed", () => {
    const onTranscriptChange = jest.fn();
    renderWithProviders(
      <TranscriptSheet
        target={target()}
        onClose={jest.fn()}
        onDescriptionChange={jest.fn()}
        onTranscriptChange={onTranscriptChange}
      />,
    );

    fireEvent.press(screen.getByLabelText("Correct the line at 0:12"));
    fireEvent.changeText(
      screen.getByLabelText("Line at 0:12"),
      "Then the left side pass.",
    );
    fireEvent.press(screen.getByText("Save line"));

    const [corrected] = onTranscriptChange.mock.calls[0];
    expect(corrected.segments[2]).toEqual({
      start: 12,
      end: 15,
      text: "Then the left side pass.",
    });
    expect(corrected.editedAt).toEqual(expect.any(Number));

    fireEvent.press(screen.getByLabelText("Select the line at 0:03"));
    fireEvent.press(screen.getByLabelText("Correct the line at 0:00"));
    fireEvent.changeText(screen.getByLabelText("Line at 0:00"), "");
    fireEvent.press(screen.getByText("Remove line"));

    expect(onTranscriptChange.mock.calls[1][0].segments).toHaveLength(2);
    expect(
      screen.getByText("Copy selected lines to description (0)"),
    ).toBeOnTheScreen();
  });

  it("offers no corrections in the read-only view", () => {
    renderWithProviders(
      <TranscriptSheet target={target()} onClose={jest.fn()} />,
    );
    expect(screen.queryByLabelText("Correct the line at 0:12")).toBeNull();
  });

  it("says so when nothing was said", () => {
    renderWithProviders(
      <TranscriptSheet
        target={target({
          transcript: { ...TRANSCRIPT, language: "und", segments: [] },
        })}
        onClose={jest.fn()}
        onDescriptionChange={jest.fn()}
      />,
    );
    expect(
      screen.getByText("No speech was found in this video."),
    ).toBeOnTheScreen();
    expect(screen.getByText("Language: not detected")).toBeOnTheScreen();
    expect(
      screen.queryByText(/^Copy selected lines to description/),
    ).toBeNull();
  });
});

function renderForm(existing: IPattern) {
  const list = createTestPatternList({ patternTypes: [TYPE] });
  const onAccepted = jest.fn<void, [NewPattern | IPattern]>();
  renderWithProviders(
    <EditPatternForm
      patterns={[existing]}
      patternTypes={[TYPE]}
      modifiers={[]}
      onAccepted={onAccepted}
      onCancel={jest.fn()}
      existing={existing}
    />,
    { lists: [list], patterns: { [list.id]: [existing] } },
  );
  return { list, saved: () => onAccepted.mock.calls.at(-1)![0] };
}

const openEditor = async () => {
  fireEvent.press(await screen.findByLabelText("Edit a video"));
  fireEvent.press(await screen.findByText("Speech"));
};

describe("transcribing from the pattern form", () => {
  it("names the first download, transcribes, and adds lines to the description", async () => {
    mockedInstalled.mockReturnValue(null);
    mockedTranscribe.mockReturnValue({
      promise: Promise.resolve({ transcript: TRANSCRIPT, timing: TIMING }),
      stop: jest.fn(),
    });
    const { saved } = renderForm(
      createTestPattern(TYPE.id, {
        id: 1,
        name: "Sugar Push",
        description: "",
        videoRefs: [{ type: "local", value: SOURCE }],
      }),
    );

    await openEditor();
    expect(screen.getByText("Downloads 61 MB once.")).toBeOnTheScreen();
    fireEvent.press(screen.getByText("Transcribe speech"));

    // Primed with the list's own words.
    await waitFor(() =>
      expect(mockedTranscribe).toHaveBeenCalledWith(
        SOURCE,
        expect.objectContaining({
          prompt: expect.stringContaining("Sugar Push"),
        }),
      ),
    );
    fireEvent.press(
      await screen.findByLabelText("Open the transcript of video 1"),
    );
    fireEvent.press(screen.getByLabelText("Select the line at 0:03"));
    fireEvent.press(screen.getByText("Copy selected lines to description (1)"));
    fireEvent.press(screen.getByText("Save"));

    await waitFor(() => expect(saved().description).toBe("Keep the frame."));
    expect(saved().videoRefs[0].transcript).toEqual(TRANSCRIPT);
  });

  it("shows an existing transcript in Edit video's Speech tab, playing from a tapped line", async () => {
    renderForm(
      createTestPattern(TYPE.id, {
        id: 1,
        videoRefs: [{ type: "local", value: SOURCE, transcript: TRANSCRIPT }],
      }),
    );

    await openEditor();

    expect(await screen.findByText("Then the whip.")).toBeOnTheScreen();
    expect(screen.queryByText("Open transcript")).toBeNull();
    expect(screen.getByText("Transcribe again")).toBeOnTheScreen();

    const player = (useVideoPlayer as jest.Mock).mock.results.at(-1)!.value;
    fireEvent.press(screen.getByLabelText("Play from 0:12"));
    expect(player.seekBy).toHaveBeenCalledWith(12);
    expect(player.play).toHaveBeenCalled();
  });

  it("saves a line corrected in the Speech tab, over the job that made the transcript", async () => {
    // The transcription finished earlier in this session: its update is re-applied to every
    // draft saved later, and must not put the model's words back.
    recordReplacement(SOURCE, withTranscript(TRANSCRIPT));
    const { saved } = renderForm(
      createTestPattern(TYPE.id, {
        id: 1,
        name: "Sugar Push",
        videoRefs: [{ type: "local", value: SOURCE, transcript: TRANSCRIPT }],
      }),
    );

    await openEditor();
    fireEvent.press(await screen.findByLabelText("Correct the line at 0:12"));
    fireEvent.changeText(
      screen.getByLabelText("Line at 0:12"),
      "Then the whip, sugar push style.",
    );
    fireEvent.press(screen.getByText("Save line"));

    expect(
      await screen.findByText("Then the whip, sugar push style."),
    ).toBeOnTheScreen();
    expect(
      screen.getByText("Transcribing again replaces your corrections."),
    ).toBeOnTheScreen();

    fireEvent.press(screen.getByLabelText("Close"));
    fireEvent.press(screen.getByText("Save"));

    // usePatternCrud runs every save through applyReplacements.
    await waitFor(() =>
      expect(
        applyReplacements(saved()).videoRefs[0].transcript!.segments[2].text,
      ).toBe("Then the whip, sugar push style."),
    );
  });

  it("does not offer to transcribe a silhouette", async () => {
    renderForm(
      createTestPattern(TYPE.id, {
        id: 1,
        videoRefs: [
          {
            type: "local",
            value: SOURCE,
            generated: { method: "on-device-tracking", createdAt: 1 },
          },
        ],
      }),
    );

    await openEditor();

    expect(
      await screen.findByText(
        "An anonymized video has no sound to transcribe.",
      ),
    ).toBeOnTheScreen();
    expect(screen.queryByText("Transcribe speech")).toBeNull();
  });
});

describe("the jobs banner", () => {
  it("cancels a running transcription", async () => {
    const stop = jest.fn();
    let reject: (e: Error) => void = () => undefined;
    stop.mockImplementation(() => reject(new Error("stopped")));
    mockedTranscribe.mockReturnValue({
      promise: new Promise((_, r) => (reject = r)),
      stop,
    });
    const list = createTestPatternList();
    renderWithProviders(<AnonymizeJobsBanner />, { lists: [list] });

    act(() => {
      jobStore.start({
        kind: "transcribe",
        listId: list.id,
        patternName: "Sugar Push",
        request: { sourceUri: SOURCE },
      });
    });
    await waitFor(() => expect(mockedTranscribe).toHaveBeenCalled());
    expect(
      screen.getByText("Sugar Push: transcribing … 0 %"),
    ).toBeOnTheScreen();

    fireEvent.press(screen.getByLabelText("Cancel Sugar Push"));

    expect(stop).toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByText(/Sugar Push/)).toBeNull());
  });
});
