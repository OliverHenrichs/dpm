import React from "react";
import { seedAsyncStorage } from "@/__mocks__/@react-native-async-storage/async-storage";
import { TERMS_VERSION } from "@/src/legal/TermsStorage";
import {
  fetchSharedList,
  MembersOnlyError,
  NoAccessError,
  publishList,
  subscribeToSharedList,
} from "@/src/firebase/FirebaseListService";
import {
  getOwnMembership,
  ListMember,
  requestMembership,
  setMembership,
  subscribeToMembers,
} from "@/src/firebase/MembershipService";
import { getPatternListById } from "@/src/pattern/data/PatternListStorage";
import PatternListManager from "@/src/pattern/list/PatternListManager";
import ShareListModal from "@/src/pattern/list/ShareListModal";
import SubscribeListModal from "@/src/pattern/list/SubscribeListModal";
import { IPatternList } from "@/src/pattern/types/IPatternList";
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
  SUBSCRIBERS: "subscribers",
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

jest.mock("@/src/firebase/MembershipService", () => ({
  getOwnMembership: jest.fn(),
  requestMembership: jest.fn(),
  setMembership: jest.fn(),
  subscribeToMembers: jest.fn(),
}));

jest.mock("@/src/firebase/PatternSuggestionService", () => ({
  subscribeToSuggestions: jest.fn(() => () => {}),
  subscribeToMutedSubscribers: jest.fn(() => () => {}),
}));

const mocked = <T extends (...args: never[]) => unknown>(fn: T) =>
  fn as unknown as jest.MockedFunction<T>;

let membersNow: ListMember[] = [];

beforeEach(() => {
  // Publishing and suggesting ask for the terms of use once; agreed here, tested in TermsConsent.
  seedAsyncStorage({ "@termsAccepted": TERMS_VERSION });
  membersNow = [];
  mocked(subscribeToSharedList).mockReturnValue(() => {});
  mocked(publishList).mockResolvedValue({
    shareCode: "AB12CD34",
    shareKey: "k".repeat(43),
  });
  mocked(getOwnMembership).mockResolvedValue(null);
  mocked(requestMembership).mockResolvedValue("requested");
  mocked(setMembership).mockResolvedValue(undefined);
  mocked(subscribeToMembers).mockImplementation((_list, onUpdate) => {
    onUpdate(membersNow);
    return () => {};
  });
});

const TYPE = createTestPatternType({ slug: "push" });

describe("asking to join", () => {
  function renderSubscribe() {
    renderWithProviders(
      <SubscribeListModal
        visible
        existingLists={[]}
        onClose={jest.fn()}
        onSubscribe={jest.fn()}
      />,
      { activeListId: null },
    );
  }

  async function lookUp(code = "AB12CD34") {
    fireEvent.changeText(screen.getByPlaceholderText("ABC12345"), code);
    fireEvent.press(screen.getByLabelText("Look up list"));
  }

  it("is offered for a members-only list, and sends the name given", async () => {
    mocked(fetchSharedList).mockRejectedValue(new MembersOnlyError());
    renderSubscribe();
    await lookUp();

    await screen.findByText("This list is for members only");
    fireEvent.changeText(
      screen.getByPlaceholderText("Your name (optional)"),
      "Alex",
    );
    fireEvent.press(screen.getByText("Ask to join"));

    await screen.findByText(/You've asked to join/);
    expect(requestMembership).toHaveBeenCalledWith("AB12CD34", "Alex");
  });

  it("does not sign in just to look a code up", async () => {
    mocked(fetchSharedList).mockRejectedValue(new MembersOnlyError());
    renderSubscribe();
    await lookUp();
    await screen.findByText("Ask to join");
    expect(requestMembership).not.toHaveBeenCalled();
  });

  it("says when the request is already waiting, and looks again", async () => {
    mocked(fetchSharedList).mockRejectedValue(new MembersOnlyError());
    mocked(getOwnMembership).mockResolvedValue("requested");
    renderSubscribe();
    await lookUp();

    await screen.findByText(/You've asked to join/);
    const list = createTestPatternList({ name: "Thursday WCS" });
    mocked(fetchSharedList).mockResolvedValue({ ...list, patterns: [] });
    fireEvent.press(screen.getByText("Look up again"));
    await screen.findByText("Thursday WCS");
  });

  it("says when the publisher turned the request away", async () => {
    mocked(fetchSharedList).mockRejectedValue(new MembersOnlyError());
    mocked(getOwnMembership).mockResolvedValue("declined");
    renderSubscribe();
    await lookUp();

    await screen.findByText("The publisher hasn't let you in to this list.");
    expect(screen.queryByText("Ask to join")).toBeNull();
  });

  it("says when the request could not be sent", async () => {
    mocked(fetchSharedList).mockRejectedValue(new MembersOnlyError());
    mocked(requestMembership).mockRejectedValue(new Error("offline"));
    renderSubscribe();
    await lookUp();
    fireEvent.press(await screen.findByText("Ask to join"));
    await screen.findByText(/Your request could not be sent/);
  });
});

describe("the publisher's members", () => {
  const member = (overrides: Partial<ListMember>): ListMember => ({
    uid: "alex-uid",
    membership: "requested",
    name: "Alex",
    updatedAt: 1,
    ...overrides,
  });

  async function renderManager(listOverrides: Partial<IPatternList> = {}) {
    const list = createTestPatternList({
      name: "Thursday WCS",
      patternTypes: [TYPE],
      shareCode: "AB12CD34",
      membersOnly: true,
      ...listOverrides,
    });
    renderWithProviders(<PatternListManager />, {
      lists: [list],
      patterns: {
        [list.id]: [createTestPattern(TYPE.id, { id: 1, name: "Sugar Push" })],
      },
    });
    await screen.findByText("Sugar Push");
  }

  it("shows how many wait to join, and lets one in", async () => {
    membersNow = [member({})];
    await renderManager();

    fireEvent.press(
      await screen.findByLabelText("Members and requests to join (1 waiting)"),
    );
    expect(screen.getByText("Alex")).toBeOnTheScreen();
    fireEvent.press(screen.getByText("Let in"));

    await waitFor(() =>
      expect(setMembership).toHaveBeenCalledWith(
        expect.objectContaining({ shareCode: "AB12CD34" }),
        "alex-uid",
        "member",
      ),
    );
  });

  it("declines a request", async () => {
    membersNow = [member({})];
    await renderManager();
    fireEvent.press(await screen.findByLabelText(/Members and requests/));
    fireEvent.press(screen.getByText("Decline"));
    await waitFor(() =>
      expect(mocked(setMembership).mock.calls[0][2]).toBe("declined"),
    );
  });

  it("removes a member after asking", async () => {
    membersNow = [member({ membership: "member" })];
    await renderManager();
    fireEvent.press(
      await screen.findByLabelText("Members and requests to join (0 waiting)"),
    );
    fireEvent.press(screen.getByText("Remove"));
    await screen.findByText("Remove Alex?");
    expect(setMembership).not.toHaveBeenCalled();
    fireEvent.press(screen.getAllByText("Remove").at(-1)!);
    await waitFor(() =>
      expect(mocked(setMembership).mock.calls[0][2]).toBe("declined"),
    );
  });

  it("lets a subscriber turned away in after all", async () => {
    membersNow = [member({ membership: "declined", name: undefined })];
    await renderManager();
    fireEvent.press(await screen.findByLabelText(/Members and requests/));
    expect(screen.getByText("Unnamed subscriber")).toBeOnTheScreen();
    fireEvent.press(screen.getByText("Let in"));
    await waitFor(() =>
      expect(mocked(setMembership).mock.calls[0][2]).toBe("member"),
    );
  });

  it("is not offered on an open list or a subscribed copy", async () => {
    await renderManager({ membersOnly: undefined });
    expect(screen.queryByLabelText(/Members and requests/)).toBeNull();
  });

  it("is not offered on a subscribed copy", async () => {
    await renderManager({ readonly: true });
    expect(screen.queryByLabelText(/Members and requests/)).toBeNull();
    expect(subscribeToMembers).not.toHaveBeenCalled();
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

  it("asks before closing a published list, then publishes it members only", async () => {
    const onPublished = renderShare(
      createTestPatternList({ shareCode: "AB12CD34" }),
    );
    fireEvent.press(screen.getByLabelText("Members only"));
    await screen.findByText("Make this list members only?");
    expect(publishList).not.toHaveBeenCalled();

    fireEvent.press(screen.getAllByText("Members only").at(-1)!);
    await waitFor(() => expect(onPublished).toHaveBeenCalled());
    expect(mocked(publishList).mock.calls[0][0].membersOnly).toBe(true);
    expect(onPublished.mock.calls[0][0].membersOnly).toBe(true);
  });

  it("opens a list again by removing the setting", async () => {
    const onPublished = renderShare(
      createTestPatternList({ shareCode: "AB12CD34", membersOnly: true }),
    );
    fireEvent.press(screen.getByLabelText("Members only"));
    await waitFor(() => expect(onPublished).toHaveBeenCalled());
    expect(mocked(publishList).mock.calls[0][0]).not.toHaveProperty(
      "membersOnly",
    );
  });

  it("holds the setting of an unpublished list until it is published", async () => {
    renderShare(createTestPatternList());
    fireEvent.press(screen.getByLabelText("Members only"));
    expect(screen.queryByText("Make this list members only?")).toBeNull();
    expect(publishList).not.toHaveBeenCalled();

    fireEvent.press(screen.getByText("Publish"));
    await waitFor(() => expect(publishList).toHaveBeenCalled());
    expect(mocked(publishList).mock.calls[0][0].membersOnly).toBe(true);
  });
});

describe("a subscribed copy that is no longer let in", () => {
  it("is kept, detached, and the subscriber is told why", async () => {
    let onError: ((err: Error) => void) | undefined;
    mocked(subscribeToSharedList).mockImplementation(
      (_code, _onUpdate, handleError) => {
        onError = handleError;
        return () => {};
      },
    );
    const list = createTestPatternList({
      name: "Thursday WCS",
      patternTypes: [TYPE],
      shareCode: "AB12CD34",
      readonly: true,
      membersOnly: true,
    });
    renderWithProviders(<PatternListManager />, {
      lists: [list],
      patterns: {
        [list.id]: [createTestPattern(TYPE.id, { id: 1, name: "Sugar Push" })],
      },
    });
    await screen.findByText("Sugar Push");
    // Restores this phone's id before listening, so a member is not refused.
    expect(mocked(subscribeToSharedList).mock.calls[0][3]).toEqual({
      membersOnly: true,
    });

    onError!(new NoAccessError());

    await screen.findByText(/is now only for members its publisher has let in/);
    const stored = await getPatternListById(list.id);
    expect(stored?.shareCode).toBeUndefined();
    expect(stored?.readonly).toBeUndefined();
  });
});
