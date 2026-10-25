import React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  publishList,
  subscribeToSharedList,
  syncPublishedList,
} from "@/src/firebase/FirebaseListService";
import {
  deleteSuggestion,
  getSuggestionStanding,
  MutedSubscriber,
  muteSubscriber,
  PatternSuggestion,
  submitSuggestion,
  subscribeToMutedSubscribers,
  subscribeToSuggestions,
  unmuteSubscriber,
} from "@/src/firebase/PatternSuggestionService";
import PatternListManager from "@/src/pattern/list/PatternListManager";
import ShareListModal from "@/src/pattern/list/ShareListModal";
import {
  IPattern,
  IPatternList,
  ISuggestionPolicy,
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

let mockFirebaseAvailable = true;
jest.mock("@/src/firebase/firebaseConfig", () => ({
  get firebaseAvailable() {
    return mockFirebaseAvailable;
  },
  db: {},
  APP_TOKEN: "test-token",
  SHARED_LISTS_COLLECTION: "sharedLists",
}));

jest.mock("@/src/firebase/FirebaseListService", () => ({
  publishList: jest.fn(),
  unpublishList: jest.fn(),
  syncPublishedList: jest.fn(),
  subscribeToSharedList: jest.fn(),
}));

jest.mock("@/src/firebase/PatternSuggestionService", () => ({
  getSuggestionStanding: jest.fn(),
  submitSuggestion: jest.fn(),
  subscribeToSuggestions: jest.fn(),
  subscribeToMutedSubscribers: jest.fn(),
  deleteSuggestion: jest.fn(),
  muteSubscriber: jest.fn(),
  unmuteSubscriber: jest.fn(),
}));

const mocked = <T extends (...args: never[]) => unknown>(fn: T) =>
  fn as unknown as jest.MockedFunction<T>;

let suggestionsNow: PatternSuggestion[] = [];
let mutedNow: MutedSubscriber[] = [];

beforeEach(() => {
  mockFirebaseAvailable = true;
  suggestionsNow = [];
  mutedNow = [];
  mocked(subscribeToSharedList).mockReturnValue(() => {});
  mocked(syncPublishedList).mockResolvedValue(undefined);
  mocked(publishList).mockResolvedValue({
    shareCode: "AB12CD34",
    shareKey: "k".repeat(43),
  });
  mocked(getSuggestionStanding).mockResolvedValue({
    muted: false,
    remaining: 2,
  });
  mocked(submitSuggestion).mockResolvedValue("sent");
  mocked(subscribeToSuggestions).mockImplementation((_list, onUpdate) => {
    onUpdate(suggestionsNow);
    return () => {};
  });
  mocked(subscribeToMutedSubscribers).mockImplementation((_list, onUpdate) => {
    onUpdate(mutedNow);
    return () => {};
  });
  mocked(deleteSuggestion).mockResolvedValue(undefined);
  mocked(muteSubscriber).mockResolvedValue(undefined);
  mocked(unmuteSubscriber).mockResolvedValue(undefined);
});

const TYPE = createTestPatternType({ slug: "push" });
const POLICY: ISuggestionPolicy = { dailyLimit: 3, per: "subscriber" };
const SUGAR_PUSH = createTestPattern(TYPE.id, { id: 1, name: "Sugar Push" });

async function renderManager(listOverrides: Partial<IPatternList>) {
  const list = createTestPatternList({
    name: "Thursday WCS",
    patternTypes: [TYPE],
    shareCode: "AB12CD34",
    ...listOverrides,
  });
  renderWithProviders(<PatternListManager />, {
    lists: [list],
    patterns: { [list.id]: [SUGAR_PUSH] },
  });
  await screen.findByText("Sugar Push");
  return list;
}

const storedPatterns = async (listId: string): Promise<IPattern[]> =>
  JSON.parse((await AsyncStorage.getItem(`@patterns_${listId}`)) ?? "[]");

describe("a subscriber", () => {
  const subscribed = { readonly: true, suggestions: POLICY };

  it("is offered to suggest only when the list takes suggestions", async () => {
    await renderManager({ readonly: true });
    expect(screen.queryByLabelText("Suggest a figure")).toBeNull();
  });

  it("is not offered to suggest without cloud sharing", async () => {
    mockFirebaseAvailable = false;
    await renderManager(subscribed);
    expect(screen.queryByLabelText("Suggest a figure")).toBeNull();
  });

  it("suggests a pattern, signed with a name", async () => {
    await renderManager(subscribed);
    fireEvent.press(screen.getByLabelText("Suggest a figure"));

    await screen.findByText("Suggestions left today: 2");
    expect(getSuggestionStanding).toHaveBeenCalledWith("AB12CD34", POLICY);
    fireEvent.changeText(screen.getByLabelText("Your name"), "Alex");
    fireEvent.changeText(
      screen.getByPlaceholderText("Figure Name"),
      "Sugar Tuck",
    );
    fireEvent.press(screen.getByText("Send suggestion"));

    await screen.findByText("Suggestion sent");
    expect(submitSuggestion).toHaveBeenCalledWith(
      "AB12CD34",
      POLICY,
      expect.objectContaining({ name: "Sugar Tuck", typeId: TYPE.id }),
      "Alex",
    );
    // The name is offered again next time.
    expect(await AsyncStorage.getItem("@suggesterName")).toBe("Alex");

    fireEvent.press(screen.getByText("OK"));
    expect(screen.queryByText("Suggestion sent")).toBeNull();
  });

  it("is told when muted, and gets no form", async () => {
    mocked(getSuggestionStanding).mockResolvedValue({
      muted: true,
      remaining: 3,
    });
    await renderManager(subscribed);
    fireEvent.press(screen.getByLabelText("Suggest a figure"));

    await screen.findByText(
      "The list owner is not taking suggestions from you.",
    );
    expect(screen.queryByText("Send suggestion")).toBeNull();

    fireEvent.press(screen.getByText("Close"));
    expect(
      screen.queryByText("The list owner is not taking suggestions from you."),
    ).toBeNull();
  });

  it("is told when today's suggestions are used up", async () => {
    mocked(getSuggestionStanding).mockResolvedValue({
      muted: false,
      remaining: 0,
    });
    await renderManager(subscribed);
    fireEvent.press(screen.getByLabelText("Suggest a figure"));

    await screen.findByText(
      "This list has taken all the suggestions it takes today. Try again tomorrow.",
    );
  });

  it("keeps the form when sending fails", async () => {
    mocked(submitSuggestion).mockRejectedValue(new Error("offline"));
    await renderManager(subscribed);
    fireEvent.press(screen.getByLabelText("Suggest a figure"));
    await screen.findByText("Suggestions left today: 2");
    fireEvent.changeText(
      screen.getByPlaceholderText("Figure Name"),
      "Sugar Tuck",
    );
    fireEvent.press(screen.getByText("Send suggestion"));

    await screen.findByText(
      "Your suggestion could not be sent. Check your connection and try again.",
    );
    expect(screen.getByDisplayValue("Sugar Tuck")).toBeOnTheScreen();
  });

  it("is told when the list stopped taking suggestions meanwhile", async () => {
    mocked(submitSuggestion).mockResolvedValue("closed");
    await renderManager(subscribed);
    fireEvent.press(screen.getByLabelText("Suggest a figure"));
    await screen.findByText("Suggestions left today: 2");
    fireEvent.changeText(
      screen.getByPlaceholderText("Figure Name"),
      "Sugar Tuck",
    );
    fireEvent.press(screen.getByText("Send suggestion"));

    await screen.findByText("This list is not taking suggestions right now.");
  });
});

describe("the publisher", () => {
  const suggestion = (
    overrides: Partial<PatternSuggestion> = {},
  ): PatternSuggestion => ({
    id: "s1",
    authorUid: "alex-uid",
    authorName: "Alex",
    pattern: {
      name: "Sugar Tuck",
      typeId: TYPE.id,
      counts: 6,
      prerequisites: [1],
      description: "A sugar push with a tuck turn.",
      tags: [],
      videoRefs: [],
      modifierRefs: [],
    },
    createdAt: Date.UTC(2026, 9, 14),
    ...overrides,
  });

  it("sees how many suggestions wait, and reviews them", async () => {
    suggestionsNow = [suggestion()];
    await renderManager({ suggestions: POLICY });

    fireEvent.press(
      await screen.findByLabelText("Review suggested figures (1)"),
    );
    expect(screen.getByText("Sugar Tuck")).toBeOnTheScreen();
    expect(screen.getByText(/From: Alex/)).toBeOnTheScreen();
    expect(
      screen.getByText("A sugar push with a tuck turn."),
    ).toBeOnTheScreen();

    fireEvent.press(screen.getByText("Close"));
    expect(screen.queryByText("Suggested figures")).toBeNull();
  });

  it("adds a suggestion to the list after reviewing it, and clears it", async () => {
    suggestionsNow = [suggestion()];
    const list = await renderManager({ suggestions: POLICY });
    fireEvent.press(
      await screen.findByLabelText("Review suggested figures (1)"),
    );
    fireEvent.press(screen.getByText("Review"));

    // The form opens on the suggestion, so it can be corrected first.
    expect(screen.getByDisplayValue("Sugar Tuck")).toBeOnTheScreen();
    fireEvent.changeText(
      screen.getByDisplayValue("Sugar Tuck"),
      "Sugar Tuck Turn",
    );
    fireEvent.press(screen.getByText("Add to list"));

    await waitFor(() => expect(deleteSuggestion).toHaveBeenCalled());
    expect(mocked(deleteSuggestion).mock.calls[0][1]).toBe("s1");
    const stored = await storedPatterns(list.id);
    expect(stored.map((p) => p.name)).toEqual([
      "Sugar Push",
      "Sugar Tuck Turn",
    ]);
    expect(stored[1].prerequisites).toEqual([1]);
  });

  it("dismisses a suggestion", async () => {
    suggestionsNow = [suggestion()];
    await renderManager({ suggestions: POLICY });
    fireEvent.press(
      await screen.findByLabelText("Review suggested figures (1)"),
    );
    fireEvent.press(screen.getByText("Dismiss"));

    await waitFor(() => expect(deleteSuggestion).toHaveBeenCalled());
    expect(mocked(deleteSuggestion).mock.calls[0][1]).toBe("s1");
  });

  it("mutes whoever sent a suggestion, after asking", async () => {
    suggestionsNow = [suggestion()];
    await renderManager({ suggestions: POLICY });
    fireEvent.press(
      await screen.findByLabelText("Review suggested figures (1)"),
    );
    fireEvent.press(screen.getByText("Mute"));
    await screen.findByText("Mute Alex?");
    fireEvent.press(screen.getAllByText("Mute").at(-1)!);

    await waitFor(() =>
      expect(muteSubscriber).toHaveBeenCalledWith(
        expect.objectContaining({ shareCode: "AB12CD34" }),
        "alex-uid",
        "Alex",
      ),
    );
  });

  it("unmutes a muted subscriber", async () => {
    mutedNow = [{ uid: "alex-uid", name: "Alex" }];
    await renderManager({ suggestions: POLICY });
    fireEvent.press(
      await screen.findByLabelText("Review suggested figures (0)"),
    );
    expect(screen.getByText("No suggestions waiting.")).toBeOnTheScreen();
    fireEvent.press(screen.getByText("Unmute"));

    await waitFor(() =>
      expect(unmuteSubscriber).toHaveBeenCalledWith(
        expect.objectContaining({ shareCode: "AB12CD34" }),
        "alex-uid",
      ),
    );
  });

  it("can still review suggestions after switching them off", async () => {
    suggestionsNow = [suggestion({ authorName: undefined })];
    await renderManager({});
    fireEvent.press(
      await screen.findByLabelText("Review suggested figures (1)"),
    );
    expect(
      screen.getByText(/Subscribers cannot suggest figures right now/),
    ).toBeOnTheScreen();
    expect(screen.getByText(/From: unnamed subscriber/)).toBeOnTheScreen();
  });

  it("shows no suggestions button when the list never took them", async () => {
    await renderManager({});
    await waitFor(() => expect(subscribeToSuggestions).toHaveBeenCalled());
    expect(screen.queryByLabelText(/Review suggested figures/)).toBeNull();
  });
});

describe("the share sheet", () => {
  function renderShare(list: IPatternList) {
    const onPublished = jest.fn<void, [IPatternList]>();
    renderWithProviders(
      <ShareListModal
        visible
        list={list}
        patterns={[]}
        onClose={jest.fn()}
        onPublished={onPublished}
        onUnpublished={jest.fn()}
      />,
      { activeListId: null },
    );
    return onPublished;
  }

  it("publishes suggestions switched on for a published list at once", async () => {
    const list = createTestPatternList({ shareCode: "AB12CD34" });
    const onPublished = renderShare(list);

    fireEvent.press(screen.getByLabelText("Let subscribers suggest figures"));

    await waitFor(() => expect(onPublished).toHaveBeenCalled());
    expect(mocked(publishList).mock.calls[0][0].suggestions).toEqual({
      dailyLimit: 3,
      per: "subscriber",
    });
    expect(onPublished.mock.calls[0][0].suggestions).toEqual({
      dailyLimit: 3,
      per: "subscriber",
    });
  });

  it("changes the limit and whom it counts", async () => {
    const list = createTestPatternList({
      shareCode: "AB12CD34",
      suggestions: POLICY,
    });
    const onPublished = renderShare(list);

    fireEvent.press(screen.getByText("10"));
    await waitFor(() => expect(onPublished).toHaveBeenCalledTimes(1));
    expect(onPublished.mock.calls[0][0].suggestions).toEqual({
      dailyLimit: 10,
      per: "subscriber",
    });

    fireEvent.press(screen.getByText("In total"));
    await waitFor(() => expect(onPublished).toHaveBeenCalledTimes(2));
    expect(onPublished.mock.calls[1][0].suggestions).toEqual({
      dailyLimit: 10,
      per: "list",
    });
  });

  it("switches suggestions off by removing the setting", async () => {
    const list = createTestPatternList({
      shareCode: "AB12CD34",
      suggestions: POLICY,
    });
    const onPublished = renderShare(list);

    fireEvent.press(screen.getByLabelText("Let subscribers suggest figures"));

    await waitFor(() => expect(onPublished).toHaveBeenCalled());
    expect(onPublished.mock.calls[0][0]).not.toHaveProperty("suggestions");
    expect(mocked(publishList).mock.calls[0][0]).not.toHaveProperty(
      "suggestions",
    );
  });

  it("holds the setting of an unpublished list until it is published", async () => {
    const list = createTestPatternList();
    const onPublished = renderShare(list);

    fireEvent.press(screen.getByLabelText("Let subscribers suggest figures"));
    expect(publishList).not.toHaveBeenCalled();
    fireEvent.press(screen.getByText("Publish"));

    await waitFor(() => expect(onPublished).toHaveBeenCalled());
    expect(onPublished.mock.calls[0][0]).toMatchObject({
      shareCode: "AB12CD34",
      suggestions: { dailyLimit: 3, per: "subscriber" },
    });
  });

  it("puts the setting back when publishing it fails", async () => {
    mocked(publishList).mockRejectedValue(new Error("offline"));
    const list = createTestPatternList({ shareCode: "AB12CD34" });
    renderShare(list);

    fireEvent.press(screen.getByLabelText("Let subscribers suggest figures"));

    await screen.findByText("offline");
    expect(
      screen.getByLabelText("Let subscribers suggest figures"),
    ).not.toBeChecked();
    // Nothing of the setting is offered while it is off.
    expect(screen.queryByText("Suggestions per day")).toBeNull();
  });
});
