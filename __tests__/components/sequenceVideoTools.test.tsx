import React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { seedBinaryFile } from "@/__mocks__/expo-file-system";
import { subscribeToSharedList } from "@/src/firebase/FirebaseListService";
import { AnonymizeJobsProvider } from "@/src/anonymize/jobs/AnonymizeJobsContext";
import { jobStore } from "@/src/anonymize/jobs/jobStore";
import { clearReplacements } from "@/src/anonymize/jobs/replaceVideo";
import PatternListManager from "@/src/pattern/list/PatternListManager";
import {
  IPatternList,
  ISequence,
  IVideoTranscript,
} from "@/src/pattern/types/IPatternList";
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

jest.mock("@/src/firebase/FirebaseListService", () => ({
  syncPublishedList: jest.fn(),
  subscribeToSharedList: jest.fn(),
}));

// The native module is absent under jest; stand in for the cut, as the figure form's tests do.
jest.mock("@/src/anonymize/shortenVideo", () => ({
  canShortenVideos: () => true,
  shortenVideo: jest.fn(async () => "file:///cache/shortened-out.mp4"),
}));

// The real panel needs expo-video; this one names its video and hands over a 2–10 s cut.
jest.mock("@/src/anonymize/components/VideoEditPanel", () => ({
  __esModule: true,
  default: ({
    sourceUri,
    onShorten,
  }: {
    sourceUri: string;
    onShorten: (r: object) => void;
  }) => {
    const { Text: MockText } = jest.requireActual("react-native");
    return (
      <>
        <MockText>{`trim ${sourceUri}`}</MockText>
        <MockText
          onPress={() =>
            onShorten({ sourceUri, startSeconds: 2, endSeconds: 10 })
          }
        >
          mock shorten
        </MockText>
      </>
    );
  },
}));

const OUTPUT = "file:///cache/shortened-out.mp4";
const SOURCE = "file:///document/rallye.mp4";
const TRANSCRIPT: IVideoTranscript = {
  language: "en",
  model: "whisper-base-q5_1",
  createdAt: 1,
  segments: [{ start: 4, end: 6, text: "Now the whip, on five." }],
};
const PUSH = createTestPatternType({ slug: "push" });
const PATTERNS = [
  createTestPattern(PUSH.id, { id: 1, name: "Sugar Push", counts: 6 }),
];

const rallye = (overrides: Partial<ISequence> = {}): ISequence => ({
  id: "rallye",
  name: "Rallye 2026",
  createdAt: 1,
  video: { type: "local", value: SOURCE, transcript: TRANSCRIPT },
  steps: [
    { kind: "figure", id: "a", patternId: 1, at: 1 },
    { kind: "free", id: "b", text: "pose", at: 4.5 },
    { kind: "free", id: "c", text: "bow", at: 12 },
  ],
  ...overrides,
});

async function renderSequences(sequence: ISequence) {
  const list = createTestPatternList({
    patternTypes: [PUSH],
    sequences: [sequence],
  });
  renderWithProviders(
    <AnonymizeJobsProvider>
      <PatternListManager />
    </AnonymizeJobsProvider>,
    { lists: [list], patterns: { [list.id]: PATTERNS } },
  );
  await screen.findByText("Sugar Push");
  fireEvent.press(screen.getByRole("tab", { name: /^Sequences/ }));
  return list;
}

const storedList = async (listId: string): Promise<IPatternList> =>
  (
    JSON.parse(
      (await AsyncStorage.getItem("@patternLists")) ?? "[]",
    ) as IPatternList[]
  ).find((l) => l.id === listId)!;

beforeEach(() => {
  (subscribeToSharedList as jest.Mock).mockReturnValue(() => {});
  seedBinaryFile(OUTPUT, Buffer.from([1]));
});
afterEach(async () => {
  await jobStore.reset();
  clearReplacements();
});

describe("a sequence's video tools", () => {
  it("offers Edit video, its transcript and Put online for a video on the phone", async () => {
    await renderSequences(rallye());
    fireEvent.press(screen.getByLabelText("Edit Rallye 2026"));

    expect(screen.getByText("Edit video")).toBeOnTheScreen();
    expect(screen.getByLabelText("Put this video online")).toBeOnTheScreen();
    fireEvent.press(screen.getByLabelText("Show transcript"));
    expect(await screen.findByText("Now the whip, on five.")).toBeOnTheScreen();
  });

  it("shortens the video as a job, and the form takes the cut with its marks moved", async () => {
    const list = await renderSequences(rallye());
    fireEvent.press(screen.getByLabelText("Edit Rallye 2026"));

    fireEvent.press(screen.getByText("Edit video"));
    expect(await screen.findByText(`trim ${SOURCE}`)).toBeOnTheScreen();
    fireEvent.press(screen.getByText("mock shorten"));

    // The form's own line, above the banner's.
    await screen.findByText("A new video is ready to check");
    fireEvent.press(screen.getAllByText("Review")[0]);
    // A sequence holds one video: there is no keeping both.
    expect(screen.queryByText("Keep both")).toBeNull();
    fireEvent.press(screen.getByText("Replace the original"));
    await waitFor(() => expect(jobStore.getJobs()[0]?.status).toBe("done"));

    // Saving the draft must not put the original back.
    fireEvent.press(screen.getByText("Save sequence"));
    expect(await screen.findByText("Close")).toBeOnTheScreen();
    await waitFor(async () =>
      expect((await storedList(list.id)).sequences?.[0].video?.value).toMatch(
        /^file:\/\/\/document\/shortened-/,
      ),
    );
    const [saved] = (await storedList(list.id)).sequences!;
    expect(saved.steps.map((s) => s.at)).toEqual([undefined, 2.5, undefined]);
    // The line said inside the cut moved with it, retimed.
    expect(saved.video?.transcript?.segments).toEqual([
      { start: 2, end: 4, text: "Now the whip, on five." },
    ]);
  });

  it("says an online video cannot be edited, and offers no Put online", async () => {
    await renderSequences(
      rallye({ video: { type: "url", value: "https://youtu.be/abc123" } }),
    );
    fireEvent.press(screen.getByLabelText("Edit Rallye 2026"));

    expect(screen.queryByLabelText("Put this video online")).toBeNull();
    // Disabled, with why under it rather than in a dialog.
    expect(screen.getByRole("button", { name: "Edit video" })).toBeDisabled();
    expect(
      screen.getByText(
        "Online videos can't be edited, only videos saved on the phone.",
      ),
    ).toBeOnTheScreen();
  });

  it("shows the transcript read-only when the sequence is opened", async () => {
    await renderSequences(rallye());
    fireEvent.press(screen.getByText("Rallye 2026"));

    expect(screen.queryByText("Edit video")).toBeNull();
    fireEvent.press(screen.getByText("Show transcript"));
    expect(await screen.findByText("Now the whip, on five.")).toBeOnTheScreen();
  });
});
