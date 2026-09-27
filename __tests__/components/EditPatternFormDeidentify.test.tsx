import React from "react";
import * as ImagePicker from "expo-image-picker";
import { seedBinaryFile } from "@/__mocks__/expo-file-system";
import EditPatternForm from "@/src/pattern/list/EditPatternForm";
import { jobStore } from "@/src/deidentify/jobs/jobStore";
import { clearReplacements } from "@/src/deidentify/jobs/replaceVideo";
import { DeidentifyProvider } from "@/src/deidentify/providers/DeidentifyProvider";
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

const OUTPUT = "file:///cache/deidentified-out.mp4";

const mockProvider: DeidentifyProvider = {
  id: "fake",
  labelKey: "deidentifyProviderTracking",
  minSeconds: 1,
  maxSeconds: 30,
  sendsFootageOffDevice: false,
  promptCount: 0,
  isAvailable: () => true,
  run: async () => ({ uri: OUTPUT }),
};

// The native pipeline is absent under jest; stand in an available provider.
jest.mock("@/src/deidentify/providers/allProviders", () => ({
  get ALL_PROVIDERS() {
    return [mockProvider];
  },
}));

// The native module is absent under jest; stand in for the cut.
jest.mock("@/src/deidentify/shortenVideo", () => ({
  canShortenVideos: () => true,
  shortenVideo: jest.fn(async () => "file:///cache/deidentified-out.mp4"),
}));

// The real panel needs expo-video; this one shows which video it was opened on and offers
// the two hand-overs as plain buttons.
jest.mock("@/src/deidentify/components/VideoEditPanel", () => ({
  __esModule: true,
  default: ({
    sourceUri,
    providers,
    onShorten,
    onDeidentify,
  }: {
    sourceUri: string;
    providers: unknown[];
    onShorten: (r: object) => void;
    onDeidentify: (p: unknown, r: object) => void;
  }) => {
    const { Text: MockText } = jest.requireActual("react-native");
    const window = { sourceUri, startSeconds: 1, endSeconds: 4 };
    return (
      <>
        <MockText>{`trim ${sourceUri}`}</MockText>
        <MockText onPress={() => onShorten(window)}>mock shorten</MockText>
        {providers.length > 0 && (
          <MockText onPress={() => onDeidentify(providers[0], window)}>
            mock deidentify
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

beforeEach(() => {
  mockedPicker.mockResolvedValue({ canceled: true } as never);
  seedBinaryFile(OUTPUT, Buffer.from([1]));
});
afterEach(async () => {
  await jobStore.reset();
  clearReplacements();
});

describe("EditPatternForm — editing a video", () => {
  it("offers the pattern's own video, and opens the trim step on it", async () => {
    renderForm(
      createTestPattern(TYPE.id, {
        id: 1,
        videoRefs: [{ type: "local", value: SOURCE }],
      }),
    );

    fireEvent.press(await editButton());
    fireEvent.press(await screen.findByLabelText("Video 1"));

    expect(await screen.findByText(`trim ${SOURCE}`)).toBeOnTheScreen();
  });

  it("goes straight to the gallery when there is nothing to de-identify, and adds the pick", async () => {
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
        kind: "deidentify",
        listId: list.id,
        patternName: "Whip",
        provider: mockProvider,
        request: { sourceUri: SOURCE, startSeconds: 0, endSeconds: 5 },
      });
    });
    await waitFor(() => expect(jobStore.getJobs()[0].status).toBe("done"));

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
    fireEvent.press(await screen.findByLabelText("Video 1"));
    fireEvent.press(await screen.findByText("mock shorten"));

    await waitFor(() => expect(jobStore.getJobs()[0]?.status).toBe("done"));
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

  it("only shortens a video that is already de-identified, keeping its provenance", async () => {
    const generated = { method: "on-device-tracking", createdAt: 1 };
    const { saved } = renderForm(
      createTestPattern(TYPE.id, {
        id: 1,
        videoRefs: [{ type: "local", value: SOURCE, generated }],
      }),
    );

    fireEvent.press(await editButton());
    fireEvent.press(await screen.findByLabelText("Video 1"));
    await screen.findByText("mock shorten");
    expect(screen.queryByText("mock deidentify")).toBeNull();

    fireEvent.press(screen.getByText("mock shorten"));
    await waitFor(() => expect(jobStore.getJobs()[0]?.status).toBe("done"));
    fireEvent.press(screen.getByText("Save"));
    await waitFor(() =>
      expect(saved().videoRefs[0].generated).toEqual(generated),
    );
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
