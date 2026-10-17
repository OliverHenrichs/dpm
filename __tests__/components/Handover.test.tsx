import React from "react";
import {
  fetchSharedList,
  subscribeToSharedList,
} from "@/src/firebase/FirebaseListService";
import {
  acceptHandover,
  getOpenHandover,
  HandoverRefusedError,
  offerHandover,
  subscribeToAcceptedHandover,
  withdrawHandover,
} from "@/src/firebase/HandoverService";
import {
  getPatternListById,
  loadPatterns,
} from "@/src/pattern/data/PatternListStorage";
import ShareListModal from "@/src/pattern/list/ShareListModal";
import TakeOverListModal from "@/src/pattern/handover/TakeOverListModal";
import { IPatternList } from "@/src/pattern/types/IPatternList";
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

jest.mock("@/src/firebase/firebaseConfig", () => ({
  firebaseAvailable: true,
  db: {},
  APP_TOKEN: "test-token",
  SHARED_LISTS_COLLECTION: "sharedLists",
}));

jest.mock("@/src/firebase/FirebaseListService", () => {
  class MembersOnlyError extends Error {}
  class NoAccessError extends Error {}
  return {
    MembersOnlyError,
    NoAccessError,
    publishList: jest.fn(),
    unpublishList: jest.fn(),
    syncPublishedList: jest.fn(),
    subscribeToSharedList: jest.fn(),
    fetchSharedList: jest.fn(),
  };
});

jest.mock("@/src/firebase/HandoverService", () => {
  class HandoverRefusedError extends Error {}
  return {
    HANDOVER_DAYS: 7,
    HANDOVER_CODE_LENGTH: 10,
    HandoverRefusedError,
    acceptHandover: jest.fn(),
    getOpenHandover: jest.fn(),
    offerHandover: jest.fn(),
    withdrawHandover: jest.fn(),
    subscribeToAcceptedHandover: jest.fn(),
    clearAcceptedHandover: jest.fn(() => Promise.resolve()),
  };
});

const mocked = <T extends (...args: never[]) => unknown>(fn: T) =>
  fn as unknown as jest.MockedFunction<T>;

const CODE = "HND0VER123";

beforeEach(() => {
  mocked(subscribeToSharedList).mockReturnValue(() => {});
  mocked(subscribeToAcceptedHandover).mockReturnValue(() => {});
  mocked(getOpenHandover).mockResolvedValue(null);
  mocked(offerHandover).mockResolvedValue(CODE);
  mocked(withdrawHandover).mockResolvedValue(undefined);
});

function publishedList(overrides: Partial<IPatternList> = {}): IPatternList {
  return createTestPatternList({
    name: "WCS Thursday",
    shareCode: "AB12CD34",
    shareKey: "k".repeat(43),
    ...overrides,
  });
}

describe("handing a list over", () => {
  function renderShare(list = publishedList()) {
    renderWithProviders(
      <ShareListModal
        visible
        list={list}
        patterns={[]}
        onClose={jest.fn()}
        onPublished={jest.fn()}
        onUnpublished={jest.fn()}
      />,
      { activeListId: null },
    );
    return list;
  }

  it("offers the list after a confirmation, and shows the code", async () => {
    const list = renderShare();
    fireEvent.press(await screen.findByText("Hand over to someone"));
    await screen.findByText("Hand over this list?");
    const buttons = screen.getAllByText("Hand over to someone");
    fireEvent.press(buttons[buttons.length - 1]);

    await screen.findByText(CODE);
    expect(offerHandover).toHaveBeenCalledWith(list);
    expect(screen.getByText(/works once, for 7 days/)).toBeTruthy();
  });

  it("shows an open offer again, and withdraws it", async () => {
    mocked(getOpenHandover).mockResolvedValue({
      code: CODE,
      expiresAt: Date.now() + 86400000,
    });
    const list = renderShare();
    await screen.findByText(CODE);
    fireEvent.press(screen.getByText("Withdraw the code"));

    await screen.findByText("Hand over to someone");
    expect(withdrawHandover).toHaveBeenCalledWith(list, CODE);
  });

  it("is not offered for a list that is not published", async () => {
    renderShare(createTestPatternList({ name: "WCS Thursday" }));
    await screen.findByText("Publish");
    expect(screen.queryByText("Hand over to someone")).toBeNull();
  });
});

describe("taking a list over", () => {
  function renderTakeOver() {
    const list = publishedList({ readonly: true, shareKey: undefined });
    const onTakenOver = jest.fn();
    renderWithProviders(
      <TakeOverListModal
        list={list}
        onClose={jest.fn()}
        onTakenOver={onTakenOver}
      />,
      { activeListId: null },
    );
    return { list, onTakenOver };
  }

  it("makes the list editable, with the new share key", async () => {
    mocked(acceptHandover).mockResolvedValue("n".repeat(43));
    const { list, onTakenOver } = renderTakeOver();
    fireEvent.changeText(
      screen.getByPlaceholderText("Handover code"),
      CODE.toLowerCase(),
    );
    fireEvent.press(screen.getByText("Take over"));

    await waitFor(() => expect(onTakenOver).toHaveBeenCalled());
    expect(acceptHandover).toHaveBeenCalledWith(list, CODE);
    const taken = onTakenOver.mock.calls[0][0] as IPatternList;
    expect(taken.readonly).toBeUndefined();
    expect(taken.shareKey).toBe("n".repeat(43));
    expect(taken.shareCode).toBe(list.shareCode);
  });

  it("says when the code is refused", async () => {
    mocked(acceptHandover).mockRejectedValue(new HandoverRefusedError());
    const { onTakenOver } = renderTakeOver();
    fireEvent.changeText(screen.getByPlaceholderText("Handover code"), CODE);
    fireEvent.press(screen.getByText("Take over"));

    await screen.findByText(/This code doesn't work/);
    expect(onTakenOver).not.toHaveBeenCalled();
  });
});

describe("the old owner's phone", () => {
  it("turns the list into a subscribed copy once someone takes it over", async () => {
    const list = publishedList();
    const typeId = list.patternTypes[0].id;
    let accepted: ((code: string) => void) | undefined;
    mocked(subscribeToAcceptedHandover).mockImplementation((_code, cb) => {
      accepted = cb;
      return () => {};
    });
    const theirs = [createTestPattern(typeId, { id: 1, name: "Sugar Push" })];
    mocked(fetchSharedList).mockResolvedValue({
      ...list,
      shareKey: undefined,
      patterns: theirs,
    });

    renderWithProviders(<></>, {
      lists: [list],
      patterns: {
        [list.id]: [createTestPattern(typeId, { id: 1, name: "Old name" })],
      },
    });
    await waitFor(() => expect(accepted).toBeDefined());
    accepted?.(CODE);

    await screen.findByText("List handed over");
    const stored = await getPatternListById(list.id);
    expect(stored?.readonly).toBe(true);
    expect(stored?.shareKey).toBeUndefined();
    expect(stored?.shareCode).toBe(list.shareCode);
    expect((await loadPatterns(list.id)).map((p) => p.name)).toEqual([
      "Sugar Push",
    ]);
  });

  it("does not watch a subscribed copy", async () => {
    renderWithProviders(<></>, {
      lists: [publishedList({ readonly: true, shareKey: undefined })],
    });
    await waitFor(() => expect(subscribeToSharedList).toHaveBeenCalled());
    expect(subscribeToAcceptedHandover).not.toHaveBeenCalled();
  });
});
