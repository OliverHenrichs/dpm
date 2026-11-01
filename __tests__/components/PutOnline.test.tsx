import React from "react";
import * as Sharing from "expo-sharing";
import EditPatternForm from "@/src/pattern/list/EditPatternForm";
import { clearReplacements } from "@/src/anonymize/jobs/replaceVideo";
import { loadPatterns } from "@/src/pattern/data/PatternListStorage";
import { awaitingLink } from "@/src/videoLinks/awaitingLink";
import { applyVideoLink } from "@/src/videoLinks/linkVideo";
import { newVideoFor } from "@/src/videoLinks/newVideoHandoff";
import AddSharedVideoSheet from "@/src/videoLinks/components/AddSharedVideoSheet";
import {
  IPattern,
  IVideoTranscript,
  NewPattern,
} from "@/src/pattern/types/IPatternList";
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
import { router } from "expo-router";

// A build with the clipboard's native module.
const mockReadCopiedText = jest.fn<Promise<string | null>, []>();
jest.mock("@/src/videoLinks/clipboard", () => ({
  canReadClipboard: true,
  readCopiedText: () => mockReadCopiedText(),
}));

const TYPE = createTestPatternType({ slug: "push" });
const SOURCE = "file:///document/video-a.mp4";
const LINK = "https://youtu.be/abc123";
const TRANSCRIPT: IVideoTranscript = {
  language: "en",
  model: "whisper-base-q5_1",
  createdAt: 1,
  segments: [{ start: 0, end: 2, text: "Anchor." }],
};

const whip = () =>
  createTestPattern(TYPE.id, {
    id: 1,
    name: "Whip",
    videoRefs: [{ type: "local", value: SOURCE, transcript: TRANSCRIPT }],
  });

function renderForm(existing: IPattern, readonly = false) {
  const list = createTestPatternList({ patternTypes: [TYPE], readonly });
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

const putOnlineButton = () => screen.findByLabelText("Put video 1 online");

afterEach(() => {
  awaitingLink.clear();
  clearReplacements();
});

describe("Put online", () => {
  it("is offered on a video saved on the phone, not on a link", async () => {
    renderForm(
      createTestPattern(TYPE.id, {
        id: 1,
        name: "Whip",
        videoRefs: [
          { type: "url", value: LINK },
          { type: "local", value: SOURCE },
        ],
      }),
    );
    expect(
      await screen.findByLabelText("Put video 2 online"),
    ).toBeOnTheScreen();
    expect(screen.queryByLabelText("Put video 1 online")).toBeNull();
  });

  it("is not offered in a read-only list", async () => {
    renderForm(whip(), true);
    await waitFor(() =>
      expect(screen.getByText("Edit Figure")).toBeOnTheScreen(),
    );
    expect(screen.queryByLabelText("Put video 1 online")).toBeNull();
  });

  it("shares the file and waits for its link", async () => {
    const { list } = renderForm(whip());
    fireEvent.press(await putOnlineButton());
    fireEvent.press(await screen.findByText("Share video"));

    await waitFor(() =>
      expect(Sharing.shareAsync).toHaveBeenCalledWith(
        SOURCE,
        expect.objectContaining({ mimeType: "video/mp4" }),
      ),
    );
    expect(awaitingLink.get()).toEqual({
      listId: list.id,
      sourceUri: SOURCE,
      patternName: "Whip",
    });
  });

  it("puts a pasted link in the video's place, keeping its transcript", async () => {
    const { list, saved } = renderForm(whip());
    fireEvent.press(await putOnlineButton());
    fireEvent.changeText(await screen.findByLabelText("https://..."), LINK);
    fireEvent.press(screen.getByText("Use this link"));

    const linked = { type: "url", value: LINK, transcript: TRANSCRIPT };
    await waitFor(async () =>
      expect((await loadPatterns(list.id))[0].videoRefs).toEqual([linked]),
    );
    // The sheet closes once the video it was opened on is gone from the draft.
    await waitFor(() => expect(screen.queryByText("Use this link")).toBeNull());
    expect(screen.queryByLabelText("Put video 1 online")).toBeNull();

    fireEvent.press(screen.getByText("Save"));
    expect(saved().videoRefs).toEqual([linked]);
  });

  it("turns to the link once the share menu returns", async () => {
    renderForm(whip());
    fireEvent.press(await putOnlineButton());
    fireEvent.press(await screen.findByText("Share video"));

    expect(await screen.findByText("1. Shared")).toBeOnTheScreen();
    expect(screen.getByText("Share again")).toBeOnTheScreen();
  });

  it("pastes the link copied in the other app", async () => {
    mockReadCopiedText.mockResolvedValueOnce(`Watch this: ${LINK}.`);
    renderForm(whip());
    fireEvent.press(await putOnlineButton());
    fireEvent.press(await screen.findByText("Paste copied link"));

    await waitFor(() =>
      expect(screen.getByLabelText("https://...").props.value).toBe(LINK),
    );
  });

  it("says when what was copied holds no link", async () => {
    mockReadCopiedText.mockResolvedValueOnce("hello");
    renderForm(whip());
    fireEvent.press(await putOnlineButton());
    fireEvent.press(await screen.findByText("Paste copied link"));

    expect(
      await screen.findByText("What you copied holds no link."),
    ).toBeOnTheScreen();
  });

  it("asks before using a link DPM cannot play", async () => {
    const drive = "https://drive.google.com/file/d/abc/view";
    const { list } = renderForm(whip());
    fireEvent.press(await putOnlineButton());
    fireEvent.changeText(await screen.findByLabelText("https://..."), drive);
    fireEvent.press(screen.getByText("Use this link"));

    expect(
      await screen.findByText(/This link won't play in DPM/),
    ).toBeOnTheScreen();
    expect((await loadPatterns(list.id))[0].videoRefs[0].type).toBe("local");

    fireEvent.press(screen.getByText("Use it anyway"));
    await waitFor(async () =>
      expect((await loadPatterns(list.id))[0].videoRefs[0]).toMatchObject({
        type: "url",
        value: drive,
      }),
    );
  });

  it("refuses something that is not a link", async () => {
    renderForm(whip());
    fireEvent.press(await putOnlineButton());
    fireEvent.changeText(await screen.findByLabelText("https://..."), "abc");
    fireEvent.press(screen.getByText("Use this link"));

    expect(
      await screen.findByText("URL must start with http:// or https://"),
    ).toBeOnTheScreen();
  });

  it("takes a link shared back from the other app while the form is open", async () => {
    const { list, saved } = renderForm(whip());
    await putOnlineButton();

    await act(() => applyVideoLink(list.id, SOURCE, LINK));

    await waitFor(() =>
      expect(screen.queryByLabelText("Put video 1 online")).toBeNull(),
    );
    fireEvent.press(screen.getByText("Save"));
    expect(saved().videoRefs).toEqual([
      { type: "url", value: LINK, transcript: TRANSCRIPT },
    ]);
  });
});

describe("a video shared to DPM", () => {
  function renderSheet(shared: { kind: "link"; url: string }) {
    const list = createTestPatternList({ patternTypes: [TYPE], name: "WCS" });
    const pattern = createTestPattern(TYPE.id, { id: 1, name: "Whip" });
    const onAdded = jest.fn();
    const onClose = jest.fn();
    renderWithProviders(
      <AddSharedVideoSheet
        shared={shared}
        onClose={onClose}
        onAdded={onAdded}
      />,
      { lists: [list], patterns: { [list.id]: [pattern] } },
    );
    return { list, onAdded, onClose };
  }

  it("goes onto the pattern picked", async () => {
    const { list, onAdded } = renderSheet({ kind: "link", url: LINK });
    fireEvent.press(await screen.findByText("Whip"));

    await waitFor(() => expect(onAdded).toHaveBeenCalledWith("Whip"));
    expect((await loadPatterns(list.id))[0].videoRefs).toEqual([
      { type: "url", value: LINK },
    ]);
  });

  it("opens the add form for a new pattern with it", async () => {
    renderSheet({ kind: "link", url: LINK });
    fireEvent.press(await screen.findByText("New figure"));

    await waitFor(() => expect(router.navigate).toHaveBeenCalled());
    // The route carries a token for the video, never the video itself.
    const { params } = (router.navigate as jest.Mock).mock.calls[0][0];
    expect(params.newVideo).not.toBe(LINK);
    expect(newVideoFor(params.newVideo)).toEqual({ type: "url", value: LINK });
  });
});
