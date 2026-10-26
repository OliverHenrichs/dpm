import React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { seedAsyncStorage } from "@/__mocks__/@react-native-async-storage/async-storage";
import { TERMS_VERSION } from "@/src/legal/TermsStorage";
import {
  publishList,
  subscribeToSharedList,
  syncPublishedList,
} from "@/src/firebase/FirebaseListService";
import {
  deleteSuggestion,
  getSuggestionStanding,
  PatternSuggestion,
  submitSuggestion,
  subscribeToMutedSubscribers,
  subscribeToSuggestions,
} from "@/src/firebase/PatternSuggestionService";
import PatternListManager from "@/src/pattern/list/PatternListManager";
import ShareListModal from "@/src/pattern/list/ShareListModal";
import { suggestedPattern } from "@/src/pattern/suggestions/suggestions";
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

jest.mock("@/src/firebase/firebaseConfig", () => ({
  firebaseAvailable: true,
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

beforeEach(() => {
  // Suggesting asks for the terms of use once; agreed here, tested in TermsConsent.
  seedAsyncStorage({ "@termsAccepted": TERMS_VERSION });
  suggestionsNow = [];
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
    onUpdate([]);
    return () => {};
  });
  mocked(deleteSuggestion).mockResolvedValue(undefined);
});

const TYPE = createTestPatternType({ slug: "push" });
const POLICY: ISuggestionPolicy = { dailyLimit: 3, per: "subscriber" };
const EDITS: ISuggestionPolicy = { ...POLICY, edits: true };
const SUGAR_PUSH = createTestPattern(TYPE.id, {
  id: 1,
  name: "Sugar Push",
  tags: ["Beginner course 2026"],
});

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

describe("a subscriber suggesting a change", () => {
  it("is offered it only when the list owner takes changes", async () => {
    await renderManager({ readonly: true, suggestions: POLICY });
    expect(screen.queryByLabelText("Suggest a change")).toBeNull();
  });

  it("sends the figure as changed, with the figure as it was", async () => {
    await renderManager({ readonly: true, suggestions: EDITS });
    fireEvent.press(screen.getByLabelText("Suggest a change"));

    await screen.findByText("Suggestions left today: 2");
    expect(
      screen.getByText(/The owner of Thursday WCS reviews your change/),
    ).toBeOnTheScreen();
    fireEvent.changeText(
      screen.getByDisplayValue("Sugar Push"),
      "Sugar Push (traveling)",
    );
    fireEvent.press(screen.getByText("Send suggestion"));

    await screen.findByText("Suggestion sent");
    expect(submitSuggestion).toHaveBeenCalledWith(
      "AB12CD34",
      EDITS,
      expect.objectContaining({ id: 1, name: "Sugar Push (traveling)" }),
      undefined,
      {
        patternId: 1,
        base: expect.objectContaining({ id: 1, name: "Sugar Push" }),
      },
    );
  });

  it("is told when nothing has changed, and sends nothing", async () => {
    await renderManager({ readonly: true, suggestions: EDITS });
    fireEvent.press(screen.getByLabelText("Suggest a change"));
    await screen.findByText("Suggestions left today: 2");

    fireEvent.press(screen.getByText("Send suggestion"));

    await screen.findByText(
      "Nothing has changed yet. Change something to suggest it.",
    );
    expect(submitSuggestion).not.toHaveBeenCalled();
  });
});

describe("the list owner reviewing a change", () => {
  const change = (to: Partial<IPattern>, patternId = 1): PatternSuggestion => ({
    id: "e1",
    authorUid: "alex-uid",
    authorName: "Alex",
    pattern: suggestedPattern({ ...SUGAR_PUSH, ...to }),
    edit: { patternId, base: suggestedPattern(SUGAR_PUSH) },
    createdAt: Date.UTC(2026, 9, 25),
  });

  async function openChange(suggestion: PatternSuggestion) {
    suggestionsNow = [suggestion];
    const list = await renderManager({ suggestions: EDITS });
    fireEvent.press(
      await screen.findByLabelText("Review suggested figures (1)"),
    );
    return list;
  }

  it("applies only the changes left ticked", async () => {
    const list = await openChange(
      change({
        name: "Sugar Push (traveling)",
        tags: ["Beginner course 2026", "Festival weekend"],
      }),
    );
    expect(screen.getByText("Change to Sugar Push")).toBeOnTheScreen();
    expect(screen.getByText("Changes: 2")).toBeOnTheScreen();
    fireEvent.press(screen.getByText("Review"));

    expect(
      screen.getByText("Name: Sugar Push → Sugar Push (traveling)"),
    ).toBeOnTheScreen();
    fireEvent.press(screen.getByText("Tag added: Festival weekend"));
    fireEvent.press(screen.getByText("Apply selected"));

    await waitFor(() =>
      expect(deleteSuggestion).toHaveBeenCalledWith(
        expect.objectContaining({ id: list.id }),
        "e1",
      ),
    );
    const [stored] = await storedPatterns(list.id);
    expect(stored).toMatchObject({
      id: 1,
      name: "Sugar Push (traveling)",
      tags: ["Beginner course 2026"],
    });
  });

  it("rejects a change, leaving the figure as it is", async () => {
    const list = await openChange(change({ name: "Sugar Push (traveling)" }));
    fireEvent.press(screen.getByText("Review"));
    fireEvent.press(screen.getByText("Reject"));

    await waitFor(() => expect(deleteSuggestion).toHaveBeenCalled());
    expect((await storedPatterns(list.id))[0]?.name ?? "Sugar Push").toBe(
      "Sugar Push",
    );
  });

  it("says when the figure is gone, and offers no review", async () => {
    await openChange(change({ name: "Sugar Push (traveling)" }, 42));
    expect(
      screen.getByText("This figure is no longer in the list."),
    ).toBeOnTheScreen();
    expect(screen.queryByText("Review")).toBeNull();
    expect(screen.getByText("Dismiss")).toBeOnTheScreen();
  });

  it("says when the figure already has the changes", async () => {
    await openChange(change({}));
    expect(
      screen.getByText("The figure already has these changes."),
    ).toBeOnTheScreen();
    expect(screen.queryByText("Review")).toBeNull();
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

  it("lets the list owner take changes, and stop by removing the setting", async () => {
    const onPublished = renderShare(
      createTestPatternList({ shareCode: "AB12CD34", suggestions: POLICY }),
    );

    fireEvent.press(screen.getByLabelText("Also changes to existing figures"));
    await waitFor(() => expect(onPublished).toHaveBeenCalledTimes(1));
    expect(onPublished.mock.calls[0][0].suggestions).toEqual(EDITS);

    fireEvent.press(screen.getByLabelText("Also changes to existing figures"));
    await waitFor(() => expect(onPublished).toHaveBeenCalledTimes(2));
    expect(onPublished.mock.calls[1][0].suggestions).toEqual(POLICY);
  });
});
