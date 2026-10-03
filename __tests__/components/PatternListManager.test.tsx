import React from "react";
import { Modal } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { seedBinaryFile } from "@/__mocks__/expo-file-system";
import { jobStore } from "@/src/deidentify/jobs/jobStore";
import { DeidentifyJobsProvider } from "@/src/deidentify/jobs/DeidentifyJobsContext";
import { shortenVideo } from "@/src/deidentify/shortenVideo";
import { subscribeToSharedList } from "@/src/firebase/FirebaseListService";
import PatternListManager from "@/src/pattern/list/PatternListManager";
import {
  IModifier,
  IPattern,
  IPatternList,
} from "@/src/pattern/types/IPatternList";
import { generateUUID } from "@/src/pattern/types/PatternType";
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

// The video editor needs the native module; pretend it is there so the post-save offer shows.
// The editor itself is covered by its own suite; here it only has to open, on
// the right video.
jest.mock("@/src/deidentify/components/VideoEditPanel", () => {
  const { Text } = jest.requireActual("react-native");
  return {
    __esModule: true,
    default: ({ sourceUri }: { sourceUri: string }) => (
      <Text>{`editing ${sourceUri}`}</Text>
    ),
  };
});

jest.mock("@/src/deidentify/shortenVideo", () => ({
  canShortenVideos: () => true,
  shortenVideo: jest.fn(async () => {
    throw new Error("no native module");
  }),
}));

// Pin where the picked video lands, so a test can start a job on it.
const MOCK_SEEDED = "file:///document/video-seeded.mp4";
jest.mock("@/src/pattern/data/videoFiles", () => ({
  persistPickedVideos: jest.fn(async () => [MOCK_SEEDED]),
  persistVideo: jest.fn(async (uri: string) => uri),
}));

jest.mock("@/src/firebase/FirebaseListService", () => ({
  syncPublishedList: jest.fn(),
  subscribeToSharedList: jest.fn(),
}));

beforeEach(() => {
  (subscribeToSharedList as jest.Mock).mockReturnValue(() => {});
});

afterEach(() => jobStore.reset());

const TYPE = createTestPatternType({ slug: "push" });

const pattern = (id: number, name: string, overrides: Partial<IPattern> = {}) =>
  createTestPattern(TYPE.id, { id, name, ...overrides });

const modifier = (name = "with a spin"): IModifier => ({
  id: generateUUID(),
  name,
  position: "postfix",
  universal: false,
  videoRefs: [],
});

async function renderManager(
  patterns: IPattern[] = [],
  listOverrides: Partial<IPatternList> = {},
) {
  const list = createTestPatternList({
    patternTypes: [TYPE],
    ...listOverrides,
  });
  // With the jobs provider, as in the app: a finished job then updates the loaded patterns.
  renderWithProviders(
    <DeidentifyJobsProvider>
      <PatternListManager />
    </DeidentifyJobsProvider>,
    {
      lists: [list],
      patterns: { [list.id]: patterns },
    },
  );
  // The provider loads storage on mount; wait for the screen to reflect it.
  // Anchor on the sort button: it is present whether or not the list is
  // read-only, and unlike "Pattern List" it appears exactly once (that string
  // is both the tab label and the section heading).
  await waitFor(() =>
    expect(screen.getByLabelText("Sort Patterns")).toBeOnTheScreen(),
  );
  // The list and its patterns load from separate keys, so the sort button can
  // be up while the rows are not. Anchor on a row too when one is expected.
  if (patterns.length > 0) await screen.findByText(patterns[0].name);
  return { list };
}

const storedPatterns = async (listId: string): Promise<IPattern[]> =>
  JSON.parse((await AsyncStorage.getItem(`@patterns_${listId}`)) ?? "[]");

const mockedPicker = ImagePicker.launchImageLibraryAsync as jest.MockedFunction<
  typeof ImagePicker.launchImageLibraryAsync
>;

/** '+' opens a menu; "New pattern" is the plain add form. */
const openAddForm = () => {
  fireEvent.press(screen.getByLabelText("Add Pattern"));
  fireEvent.press(screen.getByText("New pattern"));
};

const storedList = async (listId: string): Promise<IPatternList> => {
  const lists: IPatternList[] = JSON.parse(
    (await AsyncStorage.getItem("@patternLists")) ?? "[]",
  );
  return lists.find((l) => l.id === listId)!;
};

// The editor's title, which is also the offer's confirm label; the stub panel
// below is what tells the two apart.
const VIDEO_EDIT_TITLE = "Edit video";

describe("PatternListManager", () => {
  describe("empty state", () => {
    it("prompts to create a list when there is none", async () => {
      renderWithProviders(<PatternListManager />);

      await waitFor(() =>
        expect(screen.getByText("No pattern lists yet")).toBeOnTheScreen(),
      );
    });
  });

  describe("tabs", () => {
    it("shows the pattern list first", async () => {
      await renderManager([pattern(1, "Sugar Push")]);

      expect(screen.getByText("Sugar Push")).toBeOnTheScreen();
    });

    it("switches to modifiers and back", async () => {
      const mod = modifier("with a spin");
      await renderManager([pattern(1, "Sugar Push")], { modifiers: [mod] });

      fireEvent.press(screen.getByText(/Modifiers/));
      expect(screen.queryByText("Sugar Push")).toBeNull();
      expect(screen.getByText("with a spin")).toBeOnTheScreen();

      fireEvent.press(screen.getAllByText("Pattern List")[0]);
      expect(screen.getByText("Sugar Push")).toBeOnTheScreen();
    });

    it("counts the modifiers on the tab", async () => {
      await renderManager([], { modifiers: [modifier("a"), modifier("b")] });

      // The badge shows the bare number; the tab's name carries it for a
      // screen reader.
      expect(
        screen.getByRole("tab", { name: "Modifiers (2)" }),
      ).toBeOnTheScreen();
      expect(screen.getByText("2")).toBeOnTheScreen();
    });
  });

  describe("deleting a pattern", () => {
    it("removes it and scrubs it from prerequisites", async () => {
      // End-to-end cover for AGENT_TASKS.md B1, through the real screen.
      const { list } = await renderManager([
        pattern(1, "Sugar Push"),
        pattern(2, "Whip", { prerequisites: [1] }),
      ]);

      fireEvent.press(screen.getAllByLabelText("Delete Pattern")[0]);
      fireEvent.press(screen.getByText("Delete"));

      await waitFor(async () => {
        const stored = await storedPatterns(list.id);
        expect(stored.map((p) => p.name)).toEqual(["Whip"]);
        expect(stored[0].prerequisites).toEqual([]);
      });
    });

    it("leaves the list alone when the dialog is cancelled", async () => {
      const { list } = await renderManager([pattern(1, "Sugar Push")]);

      fireEvent.press(screen.getByLabelText("Delete Pattern"));
      fireEvent.press(screen.getByText("Cancel"));

      expect(await storedPatterns(list.id)).toHaveLength(1);
      expect(screen.getByText("Sugar Push")).toBeOnTheScreen();
    });
  });

  describe("adding a pattern", () => {
    it("persists what the form submits", async () => {
      const { list } = await renderManager([]);

      openAddForm();
      fireEvent.changeText(
        screen.getByPlaceholderText("Pattern Name"),
        "Sugar Push",
      );
      fireEvent.press(screen.getByText("Save"));

      await waitFor(async () =>
        expect((await storedPatterns(list.id)).map((p) => p.name)).toEqual([
          "Sugar Push",
        ]),
      );
    });

    it("keeps the form open when the name is blank", async () => {
      const { list } = await renderManager([]);

      openAddForm();
      fireEvent.press(screen.getByText("Save"));

      expect(await storedPatterns(list.id)).toEqual([]);
      // Still showing the form rather than silently discarding the attempt.
      expect(screen.getByPlaceholderText("Pattern Name")).toBeOnTheScreen();
    });
  });

  describe("the video jobs banner", () => {
    const SOURCE = "file:///document/video-a.mp4";
    const startShorten = (listId: string) =>
      act(() => {
        jobStore.start({
          kind: "shorten",
          listId,
          patternName: "Whip",
          request: { sourceUri: SOURCE, startSeconds: 0, endSeconds: 2 },
        });
      });
    /** Opens the finished video from the banner and puts it in place of the original. */
    const reviewAndReplace = async () => {
      fireEvent.press(await screen.findByText("Review"));
      fireEvent.press(await screen.findByText("Replace the original"));
    };

    it("links a finished job to its pattern, opening it in the list", async () => {
      (shortenVideo as jest.Mock).mockResolvedValueOnce(
        "file:///cache/shortened-out.mp4",
      );
      const { list } = await renderManager([
        pattern(1, "Sugar Push"),
        pattern(2, "Whip", { videoRefs: [{ type: "local", value: SOURCE }] }),
      ]);

      await startShorten(list.id);
      expect(
        await screen.findByText("Whip: the new video is ready to check"),
      ).toBeOnTheScreen();
      await reviewAndReplace();
      const line = await screen.findByText("Whip: shortened video is in place");
      await waitFor(() => expect(line.props.accessibilityRole).toBe("link"));
      expect(screen.queryByText(/^Counts/)).toBeNull();
      fireEvent.press(line);

      // Selecting a row opens its details inline; no row is selected before.
      expect(await screen.findByText(/^Counts/)).toBeOnTheScreen();
    });

    it("does not link a job from another list, even to a same-named pattern", async () => {
      (shortenVideo as jest.Mock).mockResolvedValueOnce(
        "file:///cache/shortened-out.mp4",
      );
      await renderManager([
        pattern(2, "Whip", { videoRefs: [{ type: "local", value: SOURCE }] }),
      ]);

      await startShorten("another-list");
      await reviewAndReplace();
      const line = await screen.findByText("Whip: shortened video is in place");

      expect(line.props.accessibilityRole).toBeUndefined();
    });

    it("shows a job whose pattern is not in this list as plain text", async () => {
      (shortenVideo as jest.Mock).mockResolvedValueOnce(
        "file:///cache/shortened-out.mp4",
      );
      const { list } = await renderManager([pattern(1, "Sugar Push")]);

      await startShorten(list.id);
      await reviewAndReplace();
      const line = await screen.findByText("Whip: shortened video is in place");

      expect(line.props.accessibilityRole).toBeUndefined();
    });
  });

  describe("adding a pattern from a video", () => {
    it("offers both ways to add behind '+'", async () => {
      await renderManager([]);

      fireEvent.press(screen.getByLabelText("Add Pattern"));

      expect(screen.getByText("New pattern")).toBeOnTheScreen();
      expect(screen.getByText("From a video")).toBeOnTheScreen();
    });

    it("seeds the new pattern with the picked video, kept in the app's documents", async () => {
      seedBinaryFile("file:///cache/ImagePicker/clip.mp4", Buffer.from([1]));
      mockedPicker.mockResolvedValue({
        canceled: false,
        assets: [{ uri: "file:///cache/ImagePicker/clip.mp4" }],
      } as never);
      const { list } = await renderManager([]);

      fireEvent.press(screen.getByLabelText("Add Pattern"));
      fireEvent.press(screen.getByText("From a video"));
      const name = await screen.findByPlaceholderText("Pattern Name");
      fireEvent.changeText(name, "Sugar Push");
      fireEvent.press(screen.getByText("Save"));

      await waitFor(async () => {
        const [saved] = await storedPatterns(list.id);
        expect(saved.name).toBe("Sugar Push");
        expect(saved.videoRefs).toHaveLength(1);
        expect(saved.videoRefs[0].value).toMatch(
          /^file:\/\/\/document\/video-/,
        );
      });
    });

    const createFromVideo = async () => {
      seedBinaryFile("file:///cache/ImagePicker/clip.mp4", Buffer.from([1]));
      mockedPicker.mockResolvedValue({
        canceled: false,
        assets: [{ uri: "file:///cache/ImagePicker/clip.mp4" }],
      } as never);
      const rendered = await renderManager([]);
      fireEvent.press(screen.getByLabelText("Add Pattern"));
      fireEvent.press(screen.getByText("From a video"));
      fireEvent.changeText(
        await screen.findByPlaceholderText("Pattern Name"),
        "Sugar Push",
      );
      return rendered;
    };

    it("offers to edit the video once the pattern is saved", async () => {
      await createFromVideo();

      fireEvent.press(screen.getByText("Save"));

      expect(await screen.findByText("Edit the video?")).toBeOnTheScreen();
    });

    it("opens the video editor when the offer is taken", async () => {
      await createFromVideo();
      fireEvent.press(screen.getByText("Save"));
      fireEvent.press(await screen.findByText("Edit video"));

      expect(
        await screen.findByText(`editing ${MOCK_SEEDED}`),
      ).toBeOnTheScreen();
      expect(screen.getByText(VIDEO_EDIT_TITLE, { exact: false })).toBeTruthy();
      expect(screen.queryByText("Edit the video?")).toBeNull();
    });

    it("leaves the video alone when the offer is put off", async () => {
      await createFromVideo();
      fireEvent.press(screen.getByText("Save"));
      fireEvent.press(await screen.findByText("Later"));

      expect(screen.queryByText("Edit the video?")).toBeNull();
      expect(screen.queryByText(VIDEO_EDIT_TITLE)).toBeNull();
    });

    it("does not ask again when the video is already being edited from the form", async () => {
      const { list } = await createFromVideo();
      // What starting a job inside the form amounts to: a job on the seeded video.
      jobStore.start({
        kind: "shorten",
        listId: list.id,
        patternName: "Sugar Push",
        request: { sourceUri: MOCK_SEEDED, startSeconds: 0, endSeconds: 1 },
      });

      fireEvent.press(screen.getByText("Save"));

      await waitFor(async () =>
        expect(await storedPatterns(list.id)).toHaveLength(1),
      );
      expect(screen.queryByText("Edit the video?")).toBeNull();
    });

    it("records a video with the camera and seeds the new pattern with it", async () => {
      (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValueOnce({
        canceled: false,
        assets: [{ uri: "file:///cache/Camera/rec.mp4" }],
      });
      const { list } = await renderManager([]);

      fireEvent.press(screen.getByLabelText("Add Pattern"));
      fireEvent.press(screen.getByText("Record a video"));
      fireEvent.changeText(
        await screen.findByPlaceholderText("Pattern Name"),
        "Sugar Push",
      );
      fireEvent.press(screen.getByText("Save"));

      await waitFor(async () =>
        expect((await storedPatterns(list.id))[0]?.videoRefs).toEqual([
          { type: "local", value: MOCK_SEEDED },
        ]),
      );
      expect(ImagePicker.launchImageLibraryAsync).not.toHaveBeenCalled();
    });

    it("explains a denied camera instead of opening the form", async () => {
      (
        ImagePicker.requestCameraPermissionsAsync as jest.Mock
      ).mockResolvedValueOnce({ granted: false });
      await renderManager([]);

      fireEvent.press(screen.getByLabelText("Add Pattern"));
      fireEvent.press(screen.getByText("Record a video"));

      expect(
        await screen.findByText("Camera permission denied"),
      ).toBeOnTheScreen();
      expect(ImagePicker.launchCameraAsync).not.toHaveBeenCalled();
      expect(screen.queryByPlaceholderText("Pattern Name")).toBeNull();

      fireEvent.press(screen.getByText("OK"));
      expect(screen.queryByText("Camera permission denied")).toBeNull();
    });

    it("opens nothing when the picker is cancelled", async () => {
      mockedPicker.mockResolvedValue({ canceled: true } as never);
      await renderManager([]);

      fireEvent.press(screen.getByLabelText("Add Pattern"));
      fireEvent.press(screen.getByText("From a video"));

      await waitFor(() => expect(mockedPicker).toHaveBeenCalled());
      expect(screen.queryByPlaceholderText("Pattern Name")).toBeNull();
    });
  });

  describe("editing a pattern", () => {
    it("opens the form pre-filled from the row", async () => {
      await renderManager([pattern(1, "Sugar Push", { counts: 6 })]);

      fireEvent.press(screen.getByLabelText("Edit Pattern"));

      expect(screen.getByText("Edit Pattern")).toBeOnTheScreen();
      expect(screen.getByPlaceholderText("Pattern Name").props.value).toBe(
        "Sugar Push",
      );
    });

    it("persists the change", async () => {
      const { list } = await renderManager([pattern(1, "Sugar Push")]);

      fireEvent.press(screen.getByLabelText("Edit Pattern"));
      fireEvent.changeText(
        screen.getByPlaceholderText("Pattern Name"),
        "Sugar Tuck",
      );
      fireEvent.press(screen.getByText("Save"));

      await waitFor(async () =>
        expect((await storedPatterns(list.id)).map((p) => p.name)).toEqual([
          "Sugar Tuck",
        ]),
      );
    });

    it("keeps the form open, and the edit, when the name is cleared", async () => {
      const { list } = await renderManager([
        pattern(1, "Sugar Push", { counts: 6 }),
      ]);

      fireEvent.press(screen.getByLabelText("Edit Pattern"));
      fireEvent.changeText(screen.getByPlaceholderText("Pattern Name"), "");
      fireEvent.press(screen.getByText("Save"));

      // AGENT_TASKS.md B12: this used to wipe the form and strand the user.
      await waitFor(() =>
        expect(screen.getByPlaceholderText("Counts").props.value).toBe("6"),
      );
      expect((await storedPatterns(list.id))[0].name).toBe("Sugar Push");
    });

    it("closes without saving when cancelled", async () => {
      const { list } = await renderManager([pattern(1, "Sugar Push")]);

      fireEvent.press(screen.getByLabelText("Edit Pattern"));
      fireEvent.changeText(
        screen.getByPlaceholderText("Pattern Name"),
        "Discarded",
      );
      fireEvent.press(screen.getByText("Cancel"));

      expect((await storedPatterns(list.id))[0].name).toBe("Sugar Push");
    });
  });

  describe("selection", () => {
    it("forgets a selected pattern once it is deleted", async () => {
      const { list } = await renderManager([
        pattern(1, "Sugar Push", { description: "The basic" }),
      ]);

      // Selecting expands the row into its details.
      fireEvent.press(screen.getByHintText("Select Pattern"));
      expect(screen.getByText("The basic")).toBeOnTheScreen();

      fireEvent.press(screen.getByLabelText("Delete Pattern"));
      fireEvent.press(screen.getByText("Delete"));

      // Wait on the authoritative outcome — the write — then assert the UI
      // synchronously. Polling the *absence* of a node instead was flaky on a
      // loaded runner: the state settles in about 50ms, but `waitFor` re-runs
      // its check inside `act`, and under contention it could still be seeing
      // the pre-delete tree when its budget ran out.
      await waitFor(async () =>
        expect(await storedPatterns(list.id)).toEqual([]),
      );

      expect(screen.queryByText("Sugar Push")).toBeNull();
      expect(screen.queryByText("The basic")).toBeNull();
    });
  });

  describe("the modifier tab", () => {
    const openModifiers = () => fireEvent.press(screen.getByText(/Modifiers/));

    it("adds one", async () => {
      const { list } = await renderManager([]);

      openModifiers();
      fireEvent.press(screen.getByLabelText("Add Modifier"));
      fireEvent.changeText(
        screen.getByPlaceholderText("Modifier Name"),
        "with a spin",
      );
      fireEvent.press(screen.getByText("Save"));

      await waitFor(async () =>
        expect(
          (await storedList(list.id)).modifiers.map((m) => m.name),
        ).toEqual(["with a spin"]),
      );
    });

    it("keeps the form open when the name is blank", async () => {
      const { list } = await renderManager([]);

      openModifiers();
      fireEvent.press(screen.getByLabelText("Add Modifier"));
      fireEvent.press(screen.getByText("Save"));

      expect((await storedList(list.id)).modifiers).toEqual([]);
      expect(screen.getByPlaceholderText("Modifier Name")).toBeOnTheScreen();
    });

    it("edits one", async () => {
      const mod = modifier("with a spin");
      const { list } = await renderManager([], { modifiers: [mod] });

      openModifiers();
      fireEvent.press(screen.getByLabelText("Edit Modifier"));
      fireEvent.changeText(
        screen.getByPlaceholderText("Modifier Name"),
        "renamed",
      );
      fireEvent.press(screen.getByText("Save"));

      await waitFor(async () =>
        expect((await storedList(list.id)).modifiers[0].name).toBe("renamed"),
      );
    });

    it("deletes one, detaching it from every pattern", async () => {
      const mod = modifier("with a spin");
      const { list } = await renderManager(
        [
          pattern(1, "Whip", {
            modifierRefs: [{ modifierId: mod.id, videoRefs: [] }],
          }),
        ],
        { modifiers: [mod] },
      );

      openModifiers();
      fireEvent.press(screen.getByLabelText("Delete Modifier"));
      fireEvent.press(screen.getByText("Delete"));

      await waitFor(async () =>
        expect((await storedList(list.id)).modifiers).toEqual([]),
      );
      expect((await storedPatterns(list.id))[0].modifierRefs).toEqual([]);
    });
  });

  describe("dismissing the modals", () => {
    /** The Android hardware back button, which each Modal handles itself. */
    const pressSystemBack = () => {
      const open = screen
        .UNSAFE_getAllByType(Modal)
        .find((m) => m.props.visible);
      fireEvent(open!, "requestClose");
    };

    it("closes the add-pattern form on cancel", async () => {
      await renderManager([]);

      openAddForm();
      expect(screen.getByPlaceholderText("Pattern Name")).toBeOnTheScreen();
      fireEvent.press(screen.getByText("Cancel"));

      expect(screen.queryByPlaceholderText("Pattern Name")).toBeNull();
    });

    it("closes the add-pattern form on the system back button", async () => {
      await renderManager([]);

      openAddForm();
      pressSystemBack();

      expect(screen.queryByPlaceholderText("Pattern Name")).toBeNull();
    });

    it("closes the edit-pattern form on the system back button", async () => {
      await renderManager([pattern(1, "Sugar Push")]);

      fireEvent.press(screen.getByLabelText("Edit Pattern"));
      pressSystemBack();

      expect(screen.queryByPlaceholderText("Pattern Name")).toBeNull();
    });

    it("closes the add-modifier form on cancel", async () => {
      await renderManager([]);

      fireEvent.press(screen.getByText(/Modifiers/));
      fireEvent.press(screen.getByLabelText("Add Modifier"));
      fireEvent.press(screen.getByText("Cancel"));

      expect(screen.queryByPlaceholderText("Modifier Name")).toBeNull();
    });

    it("closes the add-modifier form on the system back button", async () => {
      await renderManager([]);

      fireEvent.press(screen.getByText(/Modifiers/));
      fireEvent.press(screen.getByLabelText("Add Modifier"));
      pressSystemBack();

      expect(screen.queryByPlaceholderText("Modifier Name")).toBeNull();
    });

    it("closes the edit-modifier form on cancel", async () => {
      await renderManager([], { modifiers: [modifier("with a spin")] });

      fireEvent.press(screen.getByText(/Modifiers/));
      fireEvent.press(screen.getByLabelText("Edit Modifier"));
      fireEvent.press(screen.getByText("Cancel"));

      expect(screen.queryByPlaceholderText("Modifier Name")).toBeNull();
    });

    it("closes the edit-modifier form on the system back button", async () => {
      await renderManager([], { modifiers: [modifier("with a spin")] });

      fireEvent.press(screen.getByText(/Modifiers/));
      fireEvent.press(screen.getByLabelText("Edit Modifier"));
      pressSystemBack();

      expect(screen.queryByPlaceholderText("Modifier Name")).toBeNull();
    });
  });

  describe("read-only lists", () => {
    it("hides every mutating affordance", async () => {
      await renderManager([pattern(1, "Sugar Push")], { readonly: true });

      expect(screen.queryByLabelText("Add Pattern")).toBeNull();
      expect(screen.queryByLabelText("Edit Pattern")).toBeNull();
      expect(screen.queryByLabelText("Delete Pattern")).toBeNull();
    });

    it("still shows the patterns", async () => {
      await renderManager([pattern(1, "Sugar Push")], { readonly: true });

      expect(screen.getByText("Sugar Push")).toBeOnTheScreen();
    });
  });
});
