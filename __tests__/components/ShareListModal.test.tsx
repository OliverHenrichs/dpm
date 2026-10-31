import React from "react";
import { seedAsyncStorage } from "@/__mocks__/@react-native-async-storage/async-storage";
import { TERMS_VERSION } from "@/src/legal/TermsStorage";
import { Clipboard } from "react-native";
import ShareListModal from "@/src/pattern/list/ShareListModal";
import { publishList } from "@/src/firebase/FirebaseListService";
import { recordSyncFailure } from "@/src/firebase/SyncStatus";
import { countSubscribers } from "@/src/firebase/SubscriptionService";
import { IPattern, IPatternList } from "@/src/pattern/types/IPatternList";
import {
  createTestPattern,
  createTestPatternList,
} from "@/utils/testFactories";
import {
  fireEvent,
  renderWithProviders,
  screen,
  waitFor,
} from "@/utils/renderWithProviders";

/**
 * `firebaseAvailable` is derived at import from `expo-config` extras, which
 * jest-expo does not populate — so it is `false` in every test run, here and
 * on CI. Mock it so the suite chooses which branch it is exercising instead of
 * inheriting whatever the environment happens to supply.
 */
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

jest.mock("@/src/firebase/SubscriptionService", () => ({
  ACTIVE_SUBSCRIPTION_DAYS: 90,
  countSubscribers: jest.fn(),
}));

const mockedCount = countSubscribers as jest.MockedFunction<
  typeof countSubscribers
>;

const mockedPublish = publishList as jest.MockedFunction<typeof publishList>;

beforeEach(() => {
  // Publishing and suggesting ask for the terms of use once; agreed here, tested in TermsConsent.
  seedAsyncStorage({ "@termsAccepted": TERMS_VERSION });
  mockFirebaseAvailable = true;
  mockedPublish.mockResolvedValue({
    shareCode: "ABCD1234",
    shareKey: "test-share-key",
  });
  mockedCount.mockResolvedValue(0);
});

function renderShare(
  list: IPatternList = createTestPatternList({ name: "Salsa" }),
  patterns: IPattern[] = [],
) {
  const onClose = jest.fn();
  const onPublished = jest.fn<void, [IPatternList]>();
  renderWithProviders(
    <ShareListModal
      visible
      list={list}
      patterns={patterns}
      onClose={onClose}
      onPublished={onPublished}
    />,
    { activeListId: null },
  );
  return { list, onClose, onPublished };
}

const published = (name = "Salsa", shareCode = "ABCD1234") =>
  createTestPatternList({ name, shareCode });

describe("ShareListModal", () => {
  describe("an unpublished list", () => {
    it("names the list and offers to publish it", () => {
      renderShare();

      expect(screen.getByText("Share this list")).toBeOnTheScreen();
      expect(screen.getByText("Salsa")).toBeOnTheScreen();
      expect(
        screen.getByText("Anyone with the code can follow the list."),
      ).toBeOnTheScreen();
      expect(screen.getByText("Publish")).toBeOnTheScreen();
    });

    it("asks only who can open it: no code, suggestions or Done yet", () => {
      renderShare();

      expect(screen.getByText("Who can open it")).toBeOnTheScreen();
      expect(screen.queryByText("ABCD1234")).toBeNull();
      expect(screen.queryByText("Let subscribers suggest figures")).toBeNull();
      expect(screen.queryByText("Done")).toBeNull();
      expect(screen.getByText("Cancel")).toBeOnTheScreen();
    });

    it("publishes the list with its patterns", async () => {
      const patterns = [createTestPattern("t", { id: 1 })];
      const { list } = renderShare(
        createTestPatternList({ name: "Salsa" }),
        patterns,
      );

      fireEvent.press(screen.getByText("Publish"));

      await waitFor(() =>
        expect(mockedPublish).toHaveBeenCalledWith(
          expect.objectContaining({ id: list.id }),
          patterns,
        ),
      );
    });

    it("hands back the list carrying its new share code and key", async () => {
      const { onPublished, list } = renderShare();

      fireEvent.press(screen.getByText("Publish"));

      await waitFor(() =>
        expect(onPublished).toHaveBeenCalledWith(
          expect.objectContaining({
            id: list.id,
            shareCode: "ABCD1234",
            shareKey: "test-share-key",
          }),
        ),
      );
    });

    it("shows the failure instead of pretending it worked", async () => {
      mockedPublish.mockRejectedValue(new Error("network down"));
      const { onPublished } = renderShare();

      fireEvent.press(screen.getByText("Publish"));

      await waitFor(() =>
        expect(screen.getByText("network down")).toBeOnTheScreen(),
      );
      expect(onPublished).not.toHaveBeenCalled();
    });
  });

  describe("an already published list", () => {
    it("shows the code and closes with Done, without publishing again", () => {
      const { onClose } = renderShare(published());

      expect(screen.getByText("Sharing")).toBeOnTheScreen();
      expect(screen.getByText("ABCD1234")).toBeOnTheScreen();
      // Handing over and stopping live in the list's ⋮ sheet on the Lists screen.
      expect(screen.queryByText("Stop Sharing")).toBeNull();
      expect(screen.queryByText("Hand over to someone")).toBeNull();
      expect(screen.queryByText("Publish")).toBeNull();

      fireEvent.press(screen.getByText("Done"));

      expect(onClose).toHaveBeenCalled();
      expect(mockedPublish).not.toHaveBeenCalled();
    });

    it("says it is up to date", async () => {
      renderShare(published());

      expect(await screen.findByText("Up to date")).toBeOnTheScreen();
      expect(screen.queryByText("Retry")).toBeNull();
    });

    it("offers a retry when the last automatic sync failed", async () => {
      await recordSyncFailure("ABCD1234");
      const patterns = [createTestPattern("t", { id: 1 })];
      renderShare(published(), patterns);

      expect(await screen.findByText("Last sync failed")).toBeOnTheScreen();
      fireEvent.press(screen.getByText("Retry"));

      await waitFor(() =>
        expect(mockedPublish).toHaveBeenCalledWith(
          expect.objectContaining({ shareCode: "ABCD1234" }),
          patterns,
        ),
      );
      expect(await screen.findByText("Up to date")).toBeOnTheScreen();
    });

    it("copies the code to the clipboard", () => {
      const spy = jest
        .spyOn(Clipboard, "setString")
        .mockImplementation(() => {});
      renderShare(published());

      fireEvent.press(screen.getByLabelText("Copy share code"));

      expect(spy).toHaveBeenCalledWith("ABCD1234");
    });

    it("toggles the QR code", () => {
      renderShare(published());

      expect(screen.getByLabelText("Show QR code")).toBeOnTheScreen();
      fireEvent.press(screen.getByLabelText("Show QR code"));
      expect(screen.getByLabelText("Hide QR code")).toBeOnTheScreen();
    });
  });

  describe("the subscriber count", () => {
    it("shows how many phones follow a published list", async () => {
      mockedCount.mockResolvedValue(12);
      const list = published();
      renderShare(list);

      expect(
        await screen.findByText("Subscribers: 12 (last 90 days)"),
      ).toBeOnTheScreen();
      expect(mockedCount).toHaveBeenCalledWith(list);
    });

    it("says so when it cannot count, rather than showing zero", async () => {
      mockedCount.mockRejectedValue(new Error("offline"));
      renderShare(published());

      expect(
        await screen.findByText("Not available right now"),
      ).toBeOnTheScreen();
      expect(screen.queryByText(/Subscribers: 0/)).toBeNull();
    });

    it("is not counted for a list that is not published", () => {
      renderShare();

      expect(screen.queryByText(/Subscribers:/)).toBeNull();
      expect(mockedCount).not.toHaveBeenCalled();
    });
  });

  describe("without firebase credentials", () => {
    beforeEach(() => {
      mockFirebaseAvailable = false;
    });

    it("explains why sharing is unavailable", () => {
      renderShare();

      expect(
        screen.getByText(
          "Cloud sharing is not configured. Add Firebase credentials to app.json.",
        ),
      ).toBeOnTheScreen();
    });

    it("offers no way to publish", () => {
      renderShare(published());

      expect(screen.queryByText("Publish")).toBeNull();
      expect(screen.queryByText("Retry")).toBeNull();
    });

    it("can still be closed", () => {
      const { onClose } = renderShare(published());

      fireEvent.press(screen.getByText("Done"));

      expect(onClose).toHaveBeenCalled();
    });
  });
});
