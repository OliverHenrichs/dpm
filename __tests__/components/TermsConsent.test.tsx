import React from "react";
import { Linking } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import ShareListModal from "@/src/pattern/list/ShareListModal";
import SuggestPatternModal from "@/src/pattern/suggestions/SuggestPatternModal";
import { publishList } from "@/src/firebase/FirebaseListService";
import { getSuggestionStanding } from "@/src/firebase/PatternSuggestionService";
import { TERMS_VERSION } from "@/src/legal/TermsStorage";
import { TERMS_URL } from "@/src/legal/legalLinks";
import {
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

jest.mock("@/src/firebase/SubscriptionService", () => ({
  ACTIVE_SUBSCRIPTION_DAYS: 90,
  countSubscribers: jest.fn(() => Promise.resolve(0)),
}));

jest.mock("@/src/firebase/PatternSuggestionService", () => ({
  getSuggestionStanding: jest.fn(),
  submitSuggestion: jest.fn(),
}));

const mockedPublish = publishList as jest.MockedFunction<typeof publishList>;
const mockedStanding = getSuggestionStanding as jest.MockedFunction<
  typeof getSuggestionStanding
>;

beforeEach(() => {
  mockedPublish.mockResolvedValue({ shareCode: "ABCD1234", shareKey: "key" });
  mockedStanding.mockResolvedValue({ muted: false, remaining: 2 });
});

function renderShare() {
  const onPublished = jest.fn();
  renderWithProviders(
    <ShareListModal
      visible
      list={createTestPatternList({ name: "Salsa" })}
      patterns={[]}
      onClose={jest.fn()}
      onPublished={onPublished}
      onUnpublished={jest.fn()}
    />,
    { activeListId: null },
  );
  return { onPublished };
}

describe("agreeing to the terms of use before publishing", () => {
  it("asks before the first publish, and publishes nothing on cancel", async () => {
    renderShare();
    fireEvent.press(screen.getByText("Publish"));

    await screen.findByText("I agree");
    // The dialog's Cancel, rendered after the share modal's own.
    fireEvent.press(screen.getAllByText("Cancel").at(-1)!);

    await waitFor(() => expect(screen.queryByText("I agree")).toBeNull());
    expect(mockedPublish).not.toHaveBeenCalled();
    expect(await AsyncStorage.getItem("@termsAccepted")).toBeNull();
  });

  it("publishes once agreed, and remembers the agreement", async () => {
    const { onPublished } = renderShare();
    fireEvent.press(screen.getByText("Publish"));
    fireEvent.press(await screen.findByText("I agree"));

    await waitFor(() => expect(onPublished).toHaveBeenCalled());
    expect(await AsyncStorage.getItem("@termsAccepted")).toBe(TERMS_VERSION);
  });

  it("does not ask again once agreed to this version", async () => {
    await AsyncStorage.setItem("@termsAccepted", TERMS_VERSION);
    const { onPublished } = renderShare();
    fireEvent.press(screen.getByText("Publish"));

    await waitFor(() => expect(onPublished).toHaveBeenCalled());
    expect(screen.queryByText("I agree")).toBeNull();
  });

  it("asks again when the terms have changed since", async () => {
    await AsyncStorage.setItem("@termsAccepted", "2000-01-01");
    renderShare();
    fireEvent.press(screen.getByText("Publish"));

    expect(await screen.findByText("I agree")).toBeOnTheScreen();
  });

  it("opens the full terms on the website", async () => {
    const open = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    renderShare();
    fireEvent.press(screen.getByText("Publish"));
    fireEvent.press(await screen.findByText("Read the terms"));

    expect(open).toHaveBeenCalledWith(TERMS_URL);
  });
});

describe("agreeing to the terms of use before suggesting", () => {
  const type = createTestPatternType({ slug: "push" });
  const list = createTestPatternList({
    name: "Thursday WCS",
    patternTypes: [type],
    shareCode: "AB12CD34",
    readonly: true,
    suggestions: { dailyLimit: 3, per: "subscriber" },
  });

  function renderSuggest() {
    const onClose = jest.fn();
    renderWithProviders(
      <SuggestPatternModal
        visible
        list={list}
        patterns={[]}
        patternTypes={[type]}
        modifiers={[]}
        onClose={onClose}
      />,
      { activeListId: null },
    );
    return { onClose };
  }

  it("shows the form only once agreed", async () => {
    renderSuggest();
    fireEvent.press(await screen.findByText("I agree"));

    expect(
      await screen.findByText("Suggestions left today: 2"),
    ).toBeOnTheScreen();
  });

  it("closes without the form on cancel", async () => {
    const { onClose } = renderSuggest();
    await screen.findByText("I agree");
    fireEvent.press(screen.getAllByText("Cancel").at(-1)!);

    expect(onClose).toHaveBeenCalled();
    expect(screen.queryByText("Suggestions left today: 2")).toBeNull();
  });
});
