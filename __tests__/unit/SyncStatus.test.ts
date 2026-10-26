import { writeBatch } from "firebase/firestore";
import {
  publishList,
  syncPublishedList,
} from "@/src/firebase/FirebaseListService";
import { lastSyncFailure } from "@/src/firebase/SyncStatus";
import { createTestPatternList } from "@/utils/testFactories";

// A push of a published list that fails in the background is remembered, so the sharing
// sheet can offer a retry; any publish that goes through clears it.

jest.mock("@/src/firebase/firebaseConfig", () => ({
  firebaseAvailable: true,
  db: {},
  APP_TOKEN: "test-token",
  SHARED_LISTS_COLLECTION: "sharedLists",
  SHARED_LIST_OWNERS_COLLECTION: "sharedListOwners",
}));

jest.mock("@/src/firebase/auth", () => ({
  ensureSignedIn: jest.fn(async () => "owner-uid"),
  restoreSignIn: jest.fn(async () => undefined),
}));

jest.mock("firebase/firestore", () => ({
  doc: jest.fn(() => ({})),
  writeBatch: jest.fn(),
}));

const commit = jest.fn();
beforeEach(() => {
  commit.mockReset();
  (writeBatch as jest.Mock).mockReturnValue({
    set: jest.fn(),
    delete: jest.fn(),
    commit,
  });
});

const list = createTestPatternList({
  shareCode: "ABCD1234",
  shareKey: "k".repeat(43),
});

describe("the last sync of a published list", () => {
  it("is remembered when it fails, and still fails for the caller", async () => {
    commit.mockRejectedValue(new Error("offline"));

    await expect(syncPublishedList(list, [])).rejects.toThrow("offline");

    expect(await lastSyncFailure("ABCD1234")).toEqual(expect.any(Number));
    expect(await lastSyncFailure("OTHER123")).toBeNull();
  });

  it("is cleared by the next publish that goes through", async () => {
    commit.mockRejectedValueOnce(new Error("offline"));
    await syncPublishedList(list, []).catch(() => {});
    commit.mockResolvedValue(undefined);

    await publishList(list, []);

    expect(await lastSyncFailure("ABCD1234")).toBeNull();
  });
});
