import React from "react";
import { Clipboard } from "react-native";
import ShareListModal from "@/src/pattern/list/ShareListModal";
import { publishList, unpublishList } from "@/src/firebase/FirebaseListService";
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

const mockedPublish = publishList as jest.MockedFunction<typeof publishList>;
const mockedUnpublish = unpublishList as jest.MockedFunction<
  typeof unpublishList
>;

beforeEach(() => {
  mockFirebaseAvailable = true;
  mockedPublish.mockResolvedValue("ABCD1234");
  mockedUnpublish.mockResolvedValue(undefined);
});

function renderShare(
  list: IPatternList = createTestPatternList({ name: "Salsa" }),
  patterns: IPattern[] = [],
) {
  const onClose = jest.fn();
  const onPublished = jest.fn<void, [IPatternList]>();
  const onUnpublished = jest.fn<void, [IPatternList]>();
  renderWithProviders(
    <ShareListModal
      visible
      list={list}
      patterns={patterns}
      onClose={onClose}
      onPublished={onPublished}
      onUnpublished={onUnpublished}
    />,
    { activeListId: null },
  );
  return { list, onClose, onPublished, onUnpublished };
}

const published = (name = "Salsa", shareCode = "ABCD1234") =>
  createTestPatternList({ name, shareCode });

describe("ShareListModal", () => {
  describe("an unpublished list", () => {
    it("names the list and offers to publish it", () => {
      renderShare();

      expect(screen.getByText("Salsa")).toBeOnTheScreen();
      expect(screen.getByText("Publish")).toBeOnTheScreen();
    });

    it("shows no share code yet", () => {
      renderShare();

      expect(screen.queryByText("Share Code")).toBeNull();
      expect(screen.queryByText("Stop Sharing")).toBeNull();
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

    it("hands back the list carrying its new share code", async () => {
      const { onPublished, list } = renderShare();

      fireEvent.press(screen.getByText("Publish"));

      await waitFor(() =>
        expect(onPublished).toHaveBeenCalledWith(
          expect.objectContaining({ id: list.id, shareCode: "ABCD1234" }),
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
    it("shows the code and offers to sync or stop", () => {
      renderShare(published());

      expect(screen.getByText("Share Code")).toBeOnTheScreen();
      expect(screen.getByText("ABCD1234")).toBeOnTheScreen();
      expect(screen.getByText("Sync Changes")).toBeOnTheScreen();
      expect(screen.getByText("Stop Sharing")).toBeOnTheScreen();
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

  describe("stopping sharing", () => {
    it("asks before doing it", () => {
      renderShare(published());

      fireEvent.press(screen.getByText("Stop Sharing"));

      expect(screen.getByText("Stop Sharing?")).toBeOnTheScreen();
      expect(mockedUnpublish).not.toHaveBeenCalled();
    });

    it("does nothing if the confirmation is dismissed", () => {
      renderShare(published());

      fireEvent.press(screen.getByText("Stop Sharing"));
      // Index 1: the modal has its own Cancel; the dialog's renders after it.
      fireEvent.press(screen.getAllByText("Cancel")[1]);

      expect(mockedUnpublish).not.toHaveBeenCalled();
      expect(screen.queryByText("Stop Sharing?")).toBeNull();
    });

    it("unpublishes by share code once confirmed", async () => {
      renderShare(published());

      fireEvent.press(screen.getByText("Stop Sharing"));
      fireEvent.press(screen.getAllByText("Stop Sharing")[1]);

      await waitFor(() =>
        expect(mockedUnpublish).toHaveBeenCalledWith("ABCD1234"),
      );
    });

    it("hands back a list with the share code removed", async () => {
      const { onUnpublished } = renderShare(published());

      fireEvent.press(screen.getByText("Stop Sharing"));
      fireEvent.press(screen.getAllByText("Stop Sharing")[1]);

      await waitFor(() =>
        expect(screen.getByText("Sharing Stopped")).toBeOnTheScreen(),
      );
      fireEvent.press(screen.getByText("OK"));

      const handedBack = onUnpublished.mock.calls.at(-1)![0];
      expect(handedBack).not.toHaveProperty("shareCode");
    });

    it("reports a failure rather than claiming it stopped", async () => {
      mockedUnpublish.mockRejectedValue(new Error("offline"));
      const { onUnpublished } = renderShare(published());

      fireEvent.press(screen.getByText("Stop Sharing"));
      fireEvent.press(screen.getAllByText("Stop Sharing")[1]);

      await waitFor(() =>
        expect(screen.getByText("offline")).toBeOnTheScreen(),
      );
      expect(onUnpublished).not.toHaveBeenCalled();
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
      expect(screen.queryByText("Sync Changes")).toBeNull();
      expect(screen.queryByText("Stop Sharing")).toBeNull();
    });

    it("can still be closed", () => {
      const { onClose } = renderShare();

      fireEvent.press(screen.getByText("Cancel"));

      expect(onClose).toHaveBeenCalled();
    });
  });
});
