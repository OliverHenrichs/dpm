import React from "react";
import * as ImagePicker from "expo-image-picker";
import { seedBinaryFile } from "@/__mocks__/expo-file-system";
import EditPatternForm from "@/src/pattern/list/EditPatternForm";
import { jobStore } from "@/src/anonymize/jobs/jobStore";
import { clearReplacements } from "@/src/anonymize/jobs/replaceVideo";
import { AnonymizeProvider } from "@/src/anonymize/providers/AnonymizeProvider";
import { IPattern, NewPattern } from "@/src/pattern/types/IPatternList";
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

const OUTPUT = "file:///cache/anonymized-out.mp4";

const mockProvider: AnonymizeProvider = {
  id: "fake",
  labelKey: "anonymizeProviderTracking",
  minSeconds: 1,
  maxSeconds: 30,
  sendsFootageOffDevice: false,
  promptCount: 0,
  isAvailable: () => true,
  run: async () => ({ uri: OUTPUT }),
};

// The native pipeline is absent under jest; stand in an available provider.
jest.mock("@/src/anonymize/providers/allProviders", () => ({
  get ALL_PROVIDERS() {
    return [mockProvider];
  },
}));

// The native module is absent under jest; stand in for the cut.
jest.mock("@/src/anonymize/shortenVideo", () => ({
  canShortenVideos: () => true,
  shortenVideo: jest.fn(async () => "file:///cache/anonymized-out.mp4"),
}));

// The real panel needs expo-video; this one shows which video it was opened on and offers
// the two hand-overs as plain buttons.
jest.mock("@/src/anonymize/components/VideoEditPanel", () => ({
  __esModule: true,
  default: ({
    sourceUri,
    providers,
    onShorten,
    onAnonymize,
    options,
  }: {
    sourceUri: string;
    providers: unknown[];
    onShorten: (r: object) => void;
    onAnonymize: (p: unknown, r: object) => void;
    options?: React.ReactNode;
  }) => {
    const { Text: MockText } = jest.requireActual("react-native");
    const window = { sourceUri, startSeconds: 1, endSeconds: 4 };
    return (
      <>
        <MockText>{`trim ${sourceUri}`}</MockText>
        {options}
        <MockText onPress={() => onShorten(window)}>mock shorten</MockText>
        {providers.length > 0 && (
          <MockText onPress={() => onAnonymize(providers[0], window)}>
            mock anonymize
          </MockText>
        )}
      </>
    );
  },
}));

const mockedPicker = ImagePicker.launchImageLibraryAsync as jest.MockedFunction<
  typeof ImagePicker.launchImageLibraryAsync
>;

const TYPE = createTestPatternType({ slug: "push" });
const SOURCE = "file:///document/video-a.mp4";

function renderForm(existing?: IPattern, readonly = false) {
  const list = createTestPatternList({ patternTypes: [TYPE], readonly });
  const onAccepted = jest.fn<void, [NewPattern | IPattern]>();
  renderWithProviders(
    <EditPatternForm
      patterns={existing ? [existing] : []}
      patternTypes={[TYPE]}
      modifiers={[]}
      onAccepted={onAccepted}
      onCancel={jest.fn()}
      existing={existing}
    />,
    { lists: [list], patterns: { [list.id]: existing ? [existing] : [] } },
  );
  return { list, saved: () => onAccepted.mock.calls.at(-1)![0] };
}

const editButton = () => screen.findByLabelText("Edit a video");

/** Opens the finished video from its line in the form, and puts it in place of the original. */
async function reviewAndReplace() {
  fireEvent.press(await screen.findByText("Review"));
  fireEvent.press(await screen.findByText("Replace the original"));
  await waitFor(() => expect(jobStore.getJobs()[0]?.status).toBe("done"));
}

beforeEach(() => {
  mockedPicker.mockResolvedValue({ canceled: true } as never);
  seedBinaryFile(OUTPUT, Buffer.from([1]));
});
afterEach(async () => {
  await jobStore.reset();
  clearReplacements();
});

describe("EditPatternForm — editing a video", () => {
  it("opens the only video on the phone straight away", async () => {
    renderForm(
      createTestPattern(TYPE.id, {
        id: 1,
        videoRefs: [{ type: "local", value: SOURCE }],
      }),
    );

    fireEvent.press(await editButton());

    expect(await screen.findByText(`trim ${SOURCE}`)).toBeOnTheScreen();
  });

  it("goes straight to the gallery when there is nothing to anonymize, and adds the pick", async () => {
    seedBinaryFile("file:///cache/ImagePicker/b.mp4", Buffer.from([2]));
    mockedPicker.mockResolvedValue({
      canceled: false,
      assets: [{ uri: "file:///cache/ImagePicker/b.mp4" }],
    } as never);
    const { saved } = renderForm();

    fireEvent.press(await editButton());

    expect(
      await screen.findByText(/^trim file:\/\/\/document\//),
    ).toBeOnTheScreen();
    fireEvent.changeText(screen.getByPlaceholderText("Pattern Name"), "Whip");
    fireEvent.press(screen.getByText("Save"));
    await waitFor(() =>
      expect(saved().videoRefs[0].value).toMatch(/^file:\/\/\/document\//),
    );
  });

  it("puts a finished job's video into the open form", async () => {
    const { list, saved } = renderForm(
      createTestPattern(TYPE.id, {
        id: 1,
        name: "Whip",
        videoRefs: [{ type: "local", value: SOURCE }],
      }),
    );
    await editButton();

    await act(async () => {
      jobStore.start({
        kind: "anonymize",
        listId: list.id,
        patternName: "Whip",
        provider: mockProvider,
        request: { sourceUri: SOURCE, startSeconds: 0, endSeconds: 5 },
      });
    });
    await reviewAndReplace();

    fireEvent.press(screen.getByText("Save"));
    await waitFor(() => expect(saved().videoRefs[0].generated).toBeDefined());
  });

  it("shortens a video as a background job that replaces it in the draft", async () => {
    const { saved } = renderForm(
      createTestPattern(TYPE.id, {
        id: 1,
        name: "Whip",
        videoRefs: [{ type: "local", value: SOURCE }],
      }),
    );

    fireEvent.press(await editButton());
    fireEvent.press(await screen.findByText("mock shorten"));

    await reviewAndReplace();
    expect(jobStore.getJobs()[0].kind).toBe("shorten");
    fireEvent.press(screen.getByText("Save"));
    await waitFor(() =>
      expect(saved().videoRefs[0].value).toMatch(
        /^file:\/\/\/document\/shortened-/,
      ),
    );
    // Shortening keeps footage as it was: no provenance appears.
    expect(saved().videoRefs[0].generated).toBeUndefined();
  });

  it("only shortens a video that is already anonymized, keeping its provenance", async () => {
    const generated = { method: "on-device-tracking", createdAt: 1 };
    const { saved } = renderForm(
      createTestPattern(TYPE.id, {
        id: 1,
        videoRefs: [{ type: "local", value: SOURCE, generated }],
      }),
    );

    fireEvent.press(await editButton());
    await screen.findByText("mock shorten");
    expect(screen.queryByText("mock anonymize")).toBeNull();

    fireEvent.press(screen.getByText("mock shorten"));
    await reviewAndReplace();
    fireEvent.press(screen.getByText("Save"));
    await waitFor(() =>
      expect(saved().videoRefs[0].generated).toEqual(generated),
    );
  });

  it("waits for review before the draft changes, and can keep both", async () => {
    const { saved } = renderForm(
      createTestPattern(TYPE.id, {
        id: 1,
        name: "Whip",
        videoRefs: [{ type: "local", value: SOURCE }],
      }),
    );

    fireEvent.press(await editButton());
    fireEvent.press(await screen.findByText("mock shorten"));
    expect(
      await screen.findByText("A new video is ready to check"),
    ).toBeOnTheScreen();

    fireEvent.press(screen.getByText("Review"));
    fireEvent.press(await screen.findByText("Keep both"));
    await waitFor(() => expect(jobStore.getJobs()[0]?.status).toBe("done"));
    fireEvent.press(screen.getByText("Save"));
    await waitFor(() => expect(saved().videoRefs).toHaveLength(2));
    expect(saved().videoRefs[0].value).toBe(SOURCE);
    expect(saved().videoRefs[1].value).toMatch(/shortened-/);
  });

  it("discards a reviewed video, leaving the original", async () => {
    const { saved } = renderForm(
      createTestPattern(TYPE.id, {
        id: 1,
        name: "Whip",
        videoRefs: [{ type: "local", value: SOURCE }],
      }),
    );

    fireEvent.press(await editButton());
    fireEvent.press(await screen.findByText("mock shorten"));
    fireEvent.press(await screen.findByText("Review"));
    fireEvent.press(await screen.findByText("Discard the new video"));

    await waitFor(() => expect(jobStore.getJobs()).toEqual([]));
    fireEvent.press(screen.getByText("Save"));
    await waitFor(() =>
      expect(saved().videoRefs).toEqual([{ type: "local", value: SOURCE }]),
    );
  });

  it("offers to add the whole transcript before a cut drops some of it", async () => {
    const transcript = {
      language: "en",
      model: "whisper-base-q5_1",
      createdAt: 1,
      segments: [
        { start: 0, end: 0.5, text: "First the lead preps." },
        { start: 2, end: 3, text: "Anchor on five and six." },
      ],
    };
    const { saved } = renderForm(
      createTestPattern(TYPE.id, {
        id: 1,
        name: "Whip",
        description: "Lead's notes.",
        videoRefs: [{ type: "local", value: SOURCE, transcript }],
      }),
    );

    fireEvent.press(await editButton());
    fireEvent.press(await screen.findByText("mock shorten"));
    fireEvent.press(await screen.findByText("Review"));

    expect(
      await screen.findByText(/Replacing keeps 1 of 2 transcript lines/),
    ).toBeOnTheScreen();
    fireEvent.press(
      screen.getByText("Add the whole transcript to the description"),
    );
    expect(screen.getByText("Added to the description")).toBeOnTheScreen();
    fireEvent.press(screen.getByText("Replace the original"));
    await waitFor(() => expect(jobStore.getJobs()[0]?.status).toBe("done"));

    fireEvent.press(screen.getByText("Save"));
    await waitFor(() =>
      expect(saved().description).toMatch(
        /^Lead's notes\.\n\nFirst the lead preps\. Anchor on five and six\.$/,
      ),
    );
  });

  it("explains why it cannot edit when every video is online and there is no room", async () => {
    renderForm(
      createTestPattern(TYPE.id, {
        id: 1,
        videoRefs: [
          { type: "url", value: "https://y.tube/a" },
          { type: "url", value: "https://y.tube/b" },
          { type: "url", value: "https://y.tube/c" },
        ],
      }),
    );

    fireEvent.press(await editButton());

    expect(
      await screen.findByText(/Only videos saved on the phone can be edited/),
    ).toBeOnTheScreen();
    expect(mockedPicker).not.toHaveBeenCalled();
  });

  it("asks which video when there are several, and says why online videos are missing", async () => {
    renderForm(
      createTestPattern(TYPE.id, {
        id: 1,
        videoRefs: [
          { type: "local", value: SOURCE },
          { type: "url", value: "https://y.tube/a" },
          { type: "local", value: "file:///document/video-b.mp4" },
        ],
      }),
    );

    fireEvent.press(await editButton());
    expect(
      await screen.findByText(
        "Online videos can't be edited, only videos saved on the phone.",
      ),
    ).toBeOnTheScreen();
    fireEvent.press(screen.getByLabelText("Video 3"));

    expect(
      await screen.findByText("trim file:///document/video-b.mp4"),
    ).toBeOnTheScreen();
  });

  it("edits a video from its own thumbnail, and gives online videos no edit button", async () => {
    renderForm(
      createTestPattern(TYPE.id, {
        id: 1,
        videoRefs: [
          { type: "url", value: "https://y.tube/a" },
          { type: "local", value: SOURCE },
        ],
      }),
    );

    fireEvent.press(await screen.findByLabelText("Edit video 2"));

    expect(await screen.findByText(`trim ${SOURCE}`)).toBeOnTheScreen();
    expect(screen.queryByLabelText("Edit video 1")).toBeNull();
  });

  it("says why '+' is off once there are three videos", async () => {
    renderForm(
      createTestPattern(TYPE.id, {
        id: 1,
        videoRefs: [
          { type: "local", value: SOURCE },
          { type: "url", value: "https://y.tube/a" },
          { type: "url", value: "https://y.tube/b" },
        ],
      }),
    );

    expect(
      await screen.findByText(
        "Holds up to 3 videos. Remove one to add another.",
      ),
    ).toBeOnTheScreen();
  });

  it("is not offered on a read-only list", async () => {
    renderForm(
      createTestPattern(TYPE.id, {
        id: 1,
        videoRefs: [{ type: "local", value: SOURCE }],
      }),
      true,
    );

    await screen.findByLabelText("Add");
    await waitFor(() =>
      expect(screen.queryByLabelText("Edit a video")).toBeNull(),
    );
  });
});
