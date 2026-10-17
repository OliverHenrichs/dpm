import React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { subscribeToSharedList } from "@/src/firebase/FirebaseListService";
import { removeSubscription } from "@/src/firebase/SubscriptionService";
import PatternListSelector from "@/src/pattern/list/PatternListSelector";
import { IPatternList } from "@/src/pattern/types/IPatternList";
import { seedAsyncStorage } from "@/__mocks__/@react-native-async-storage/async-storage";
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

beforeEach(() => {
  (subscribeToSharedList as jest.Mock).mockReturnValue(() => {});
});

const storedLists = async (): Promise<IPatternList[]> =>
  JSON.parse((await AsyncStorage.getItem("@patternLists")) ?? "[]");

/**
 * Rendered with no active list: the header shows the active list's name, so an
 * active list would make every `getByText(name)` ambiguous with the card.
 * The active-list highlight has its own test below.
 *
 * Waits on something the stored lists produce, not on the header — the header
 * renders synchronously, so waiting for it says nothing about whether the read
 * from storage has landed. Under load that gap is wide enough to lose a row.
 */
async function renderSelector(lists: IPatternList[] = []) {
  renderWithProviders(<PatternListSelector />, { lists, activeListId: null });
  await screen.findByText(
    lists.length > 0 ? lists[0].name : "No pattern lists yet",
  );
}

describe("PatternListSelector", () => {
  describe("empty state", () => {
    it("invites the user to create their first list", async () => {
      await renderSelector([]);

      expect(screen.getByText("No pattern lists yet")).toBeOnTheScreen();
      expect(
        screen.getByText(/what each one builds on, its variations/),
      ).toBeOnTheScreen();
    });

    it("opens the example list on the map", async () => {
      await renderSelector([]);

      fireEvent.press(screen.getByText("Explore an example"));

      await waitFor(() =>
        expect(router.navigate).toHaveBeenCalledWith("/graph"),
      );
      const [example] = await storedLists();
      expect(example.name).toBe("Example: West Coast Swing");
      expect(await AsyncStorage.getItem("@activeListId")).toBe(example.id);
      const patterns = JSON.parse(
        (await AsyncStorage.getItem(`@patterns_${example.id}`)) ?? "[]",
      );
      expect(patterns.length).toBeGreaterThan(0);
    });

    it("offers to start a list of one's own", async () => {
      await renderSelector([]);

      fireEvent.press(screen.getByText("Start my own list"));

      expect(await screen.findByText("West Coast Swing")).toBeOnTheScreen();
    });

    it("still offers the create button", async () => {
      await renderSelector([]);

      expect(screen.getByLabelText("Create Pattern List")).toBeOnTheScreen();
    });
  });

  describe("listing", () => {
    it("shows every stored list", async () => {
      await renderSelector([
        createTestPatternList({ name: "West Coast Swing" }),
        createTestPatternList({ name: "Salsa" }),
      ]);

      expect(screen.getByText("West Coast Swing")).toBeOnTheScreen();
      expect(screen.getByText("Salsa")).toBeOnTheScreen();
    });

    it("marks a published list", async () => {
      await renderSelector([
        createTestPatternList({ name: "Shared", shareCode: "ABCD1234" }),
      ]);

      expect(screen.getByLabelText("Share to Cloud")).toBeOnTheScreen();
    });

    it("marks a read-only list", async () => {
      await renderSelector([
        createTestPatternList({ name: "Subscribed", readonly: true }),
      ]);

      expect(screen.getByLabelText("Read-only list")).toBeOnTheScreen();
    });
  });

  describe("selecting a list", () => {
    it("makes it active and moves to the patterns screen", async () => {
      const list = createTestPatternList({ name: "Salsa" });
      seedAsyncStorage({
        [`@patterns_${list.id}`]: JSON.stringify([
          createTestPattern("t", { id: 1 }),
        ]),
      });
      await renderSelector([list]);

      fireEvent.press(screen.getByText("Salsa"));

      await waitFor(async () =>
        expect(await AsyncStorage.getItem("@activeListId")).toBe(list.id),
      );
      expect(router.navigate).toHaveBeenCalledWith("/patterns");
    });
  });

  describe("the active list", () => {
    it("is marked with a tick", async () => {
      const active = createTestPatternList({ name: "Salsa" });
      const other = createTestPatternList({ name: "Bachata" });
      renderWithProviders(<PatternListSelector />, {
        lists: [active, other],
        activeListId: active.id,
      });

      const salsa = await screen.findByRole("radio", { name: "Salsa" });
      // Exactly one, so the tick tracks the active list rather than every row.
      expect(salsa.props.accessibilityState).toMatchObject({ checked: true });
      expect(
        screen.getByRole("radio", { name: "Bachata" }).props.accessibilityState,
      ).toMatchObject({ checked: false });
    });
  });

  describe("the long-press action sheet", () => {
    it("offers edit, share and delete for an ordinary list", async () => {
      await renderSelector([createTestPatternList({ name: "Salsa" })]);

      fireEvent(screen.getByText("Salsa"), "longPress");

      expect(screen.getByText("Edit Pattern List")).toBeOnTheScreen();
      expect(screen.getByText("Delete Pattern List")).toBeOnTheScreen();
    });

    it("offers none of them for a read-only list", async () => {
      await renderSelector([
        createTestPatternList({ name: "Subscribed", readonly: true }),
      ]);

      fireEvent(screen.getByText("Subscribed"), "longPress");

      expect(screen.queryByText("Edit Pattern List")).toBeNull();
      expect(screen.queryByText("Delete Pattern List")).toBeNull();
      expect(
        screen.getByText(
          "This list is read-only and cannot be edited or deleted.",
        ),
      ).toBeOnTheScreen();
    });
  });

  describe("unsubscribing", () => {
    const subscribed = () =>
      createTestPatternList({
        name: "Thursday Group",
        readonly: true,
        shareCode: "ABCD1234",
      });

    it("is offered for a subscribed list, not edit or delete", async () => {
      await renderSelector([subscribed()]);

      fireEvent(screen.getByText("Thursday Group"), "longPress");

      expect(screen.getByText("Unsubscribe from List")).toBeOnTheScreen();
      expect(screen.queryByText("Delete Pattern List")).toBeNull();
      expect(
        screen.getByText(
          "You follow this list. Only its publisher can change it.",
        ),
      ).toBeOnTheScreen();
    });

    it("is not offered for a read-only import", async () => {
      await renderSelector([
        createTestPatternList({ name: "Imported", readonly: true }),
      ]);

      fireEvent(screen.getByText("Imported"), "longPress");

      expect(screen.queryByText("Unsubscribe from List")).toBeNull();
    });

    it("asks first, then removes the list and stops counting this phone", async () => {
      const list = subscribed();
      await renderSelector([list]);

      fireEvent(screen.getByText("Thursday Group"), "longPress");
      fireEvent.press(screen.getByText("Unsubscribe from List"));
      expect(
        screen.getByText(
          "Remove 'Thursday Group' from this phone? You can subscribe again with its share code.",
        ),
      ).toBeOnTheScreen();
      fireEvent.press(screen.getByText("Unsubscribe"));

      await waitFor(async () => expect(await storedLists()).toEqual([]));
      expect(removeSubscription).toHaveBeenCalledWith("ABCD1234");
    });

    it("still removes the list when the phone is offline", async () => {
      (removeSubscription as jest.Mock).mockRejectedValueOnce(
        new Error("offline"),
      );
      await renderSelector([subscribed()]);

      fireEvent(screen.getByText("Thursday Group"), "longPress");
      fireEvent.press(screen.getByText("Unsubscribe from List"));
      fireEvent.press(screen.getByText("Unsubscribe"));

      await waitFor(async () => expect(await storedLists()).toEqual([]));
    });
  });

  describe("deleting a list", () => {
    it("asks first, naming the list", async () => {
      await renderSelector([createTestPatternList({ name: "Salsa" })]);

      fireEvent(screen.getByText("Salsa"), "longPress");
      fireEvent.press(screen.getByText("Delete Pattern List"));

      expect(
        screen.getByText("Delete pattern list 'Salsa'?"),
      ).toBeOnTheScreen();
    });

    it("removes it once confirmed", async () => {
      const list = createTestPatternList({ name: "Salsa" });
      await renderSelector([list]);

      fireEvent(screen.getByText("Salsa"), "longPress");
      fireEvent.press(screen.getByText("Delete Pattern List"));
      fireEvent.press(screen.getByText("Delete"));

      await waitFor(async () => expect(await storedLists()).toEqual([]));
    });

    it("keeps it when the dialog is cancelled", async () => {
      await renderSelector([createTestPatternList({ name: "Salsa" })]);

      fireEvent(screen.getByText("Salsa"), "longPress");
      fireEvent.press(screen.getByText("Delete Pattern List"));
      fireEvent.press(screen.getByText("Cancel"));

      expect(await storedLists()).toHaveLength(1);
      expect(screen.getByText("Salsa")).toBeOnTheScreen();
    });

    it("also drops the list's patterns", async () => {
      const list = createTestPatternList({ name: "Salsa" });
      seedAsyncStorage({
        [`@patterns_${list.id}`]: JSON.stringify([
          createTestPattern("t", { id: 1 }),
        ]),
      });
      await renderSelector([list]);

      fireEvent(screen.getByText("Salsa"), "longPress");
      fireEvent.press(screen.getByText("Delete Pattern List"));
      fireEvent.press(screen.getByText("Delete"));

      await waitFor(async () =>
        expect(await AsyncStorage.getItem(`@patterns_${list.id}`)).toBeNull(),
      );
    });
  });
});
