import React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  subscribeToSharedList,
  unpublishList,
} from "@/src/firebase/FirebaseListService";
import { getOpenHandover } from "@/src/firebase/HandoverService";
import PatternListSelector from "@/src/pattern/list/PatternListSelector";
import { IPatternList } from "@/src/pattern/types/IPatternList";
import { createTestPatternList } from "@/utils/testFactories";
import {
  fireEvent,
  renderWithProviders,
  screen,
  waitFor,
} from "@/utils/renderWithProviders";

// The ⋮ sheet of a list on the Lists screen, with cloud sharing configured: where the list
// owner hands a list over or stops sharing it (the sharing sheet keeps only its settings).

jest.mock("@/src/firebase/firebaseConfig", () => ({
  firebaseAvailable: true,
  db: {},
  APP_TOKEN: "test-token",
  SHARED_LISTS_COLLECTION: "sharedLists",
}));

jest.mock("@/src/firebase/FirebaseListService", () => ({
  syncPublishedList: jest.fn(),
  subscribeToSharedList: jest.fn(),
  publishList: jest.fn(),
  unpublishList: jest.fn(),
  fetchSharedList: jest.fn(),
}));

jest.mock("@/src/firebase/SubscriptionService", () => ({
  refreshSubscription: jest.fn(async () => undefined),
  removeSubscription: jest.fn(async () => undefined),
}));

jest.mock("@/src/firebase/HandoverService", () => ({
  HANDOVER_DAYS: 7,
  getOpenHandover: jest.fn(),
  offerHandover: jest.fn(),
  withdrawHandover: jest.fn(),
  subscribeToAcceptedHandover: jest.fn(() => () => {}),
  clearAcceptedHandover: jest.fn(() => Promise.resolve()),
}));

const mockedUnpublish = unpublishList as jest.MockedFunction<
  typeof unpublishList
>;

beforeEach(() => {
  (subscribeToSharedList as jest.Mock).mockReturnValue(() => {});
  (getOpenHandover as jest.Mock).mockResolvedValue(null);
  mockedUnpublish.mockResolvedValue(undefined);
});

const storedLists = async (): Promise<IPatternList[]> =>
  JSON.parse((await AsyncStorage.getItem("@patternLists")) ?? "[]");

const published = () =>
  createTestPatternList({
    name: "Thursday WCS",
    shareCode: "ABCD1234",
    shareKey: "k".repeat(43),
  });

async function openMenu(list: IPatternList) {
  renderWithProviders(<PatternListSelector />, {
    lists: [list],
    activeListId: null,
  });
  fireEvent(await screen.findByText(list.name), "longPress");
}

describe("a list's ⋮ sheet", () => {
  it("offers handing over and stopping for the list owner's published list", async () => {
    await openMenu(published());

    expect(screen.getByText("Sharing")).toBeOnTheScreen();
    expect(screen.getByText("Hand over")).toBeOnTheScreen();
    expect(screen.getByText("Stop Sharing")).toBeOnTheScreen();
  });

  it("offers neither for a list that is not published", async () => {
    await openMenu(createTestPatternList({ name: "Thursday WCS" }));

    expect(screen.getByText("Share this list")).toBeOnTheScreen();
    expect(screen.queryByText("Hand over")).toBeNull();
    expect(screen.queryByText("Stop Sharing")).toBeNull();
  });

  it("offers neither for a subscribed list", async () => {
    await openMenu({ ...published(), readonly: true, shareKey: undefined });

    expect(screen.queryByText("Hand over")).toBeNull();
    expect(screen.queryByText("Stop Sharing")).toBeNull();
  });

  it("opens the handover", async () => {
    await openMenu(published());

    fireEvent.press(screen.getByText("Hand over"));

    expect(await screen.findByText("Hand over to someone")).toBeOnTheScreen();
  });

  describe("stopping sharing", () => {
    it("asks first, then keeps the list on the phone without its code", async () => {
      await openMenu(published());

      fireEvent.press(screen.getByText("Stop Sharing"));
      expect(screen.getByText("Stop Sharing?")).toBeOnTheScreen();
      expect(mockedUnpublish).not.toHaveBeenCalled();
      fireEvent.press(screen.getAllByText("Stop Sharing").at(-1)!);

      expect(await screen.findByText("Sharing Stopped")).toBeOnTheScreen();
      expect(mockedUnpublish).toHaveBeenCalledWith(
        expect.objectContaining({ shareCode: "ABCD1234" }),
      );
      const [kept] = await storedLists();
      expect(kept.name).toBe("Thursday WCS");
      expect(kept).not.toHaveProperty("shareCode");
      expect(kept).not.toHaveProperty("shareKey");
    });

    it("does nothing if the confirmation is dismissed", async () => {
      await openMenu(published());

      fireEvent.press(screen.getByText("Stop Sharing"));
      fireEvent.press(screen.getByText("Cancel"));

      expect(screen.queryByText("Stop Sharing?")).toBeNull();
      expect(mockedUnpublish).not.toHaveBeenCalled();
    });

    it("reports a failure and keeps the list shared", async () => {
      mockedUnpublish.mockRejectedValue(new Error("offline"));
      await openMenu(published());

      fireEvent.press(screen.getByText("Stop Sharing"));
      fireEvent.press(screen.getAllByText("Stop Sharing").at(-1)!);

      expect(await screen.findByText("offline")).toBeOnTheScreen();
      await waitFor(async () =>
        expect((await storedLists())[0].shareCode).toBe("ABCD1234"),
      );
    });
  });
});
