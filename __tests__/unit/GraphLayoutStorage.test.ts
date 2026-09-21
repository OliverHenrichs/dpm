import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  clearGraphLayout,
  collectOrphanedLayoutKeys,
  getGraphLayoutKey,
  loadGraphLayout,
  saveGraphLayout,
} from "@/src/pattern/graph/data/GraphLayoutStorage";
import {
  GRAPH_LAYOUT_VERSION,
  StoredGraphLayout,
} from "@/src/pattern/graph/model/resolveLayout";
import {
  peekAsyncStorage,
  resetAsyncStorageMock,
  seedAsyncStorage,
} from "@/__mocks__/@react-native-async-storage/async-storage";

jest.mock("@react-native-async-storage/async-storage");

const LIST = "list-1";

const layout: StoredGraphLayout = {
  version: GRAPH_LAYOUT_VERSION,
  positions: { "1": { x: 10, y: 20 } },
  updatedAt: 1234,
};

beforeEach(() => {
  resetAsyncStorageMock();
});

describe("saving and loading", () => {
  it("round-trips a layout", async () => {
    await saveGraphLayout(LIST, layout);

    expect(await loadGraphLayout(LIST)).toEqual(layout);
  });

  it("keys the layout by list", async () => {
    await saveGraphLayout(LIST, layout);

    expect(await loadGraphLayout("other-list")).toBeNull();
  });

  it("returns null for a list that has never been arranged", async () => {
    expect(await loadGraphLayout(LIST)).toBeNull();
  });
});

describe("bad stored data", () => {
  /** Every failure degrades to the automatic layout; none of them throw. */
  const expectNull = async () => expect(await loadGraphLayout(LIST)).toBeNull();

  it("survives unparseable JSON", async () => {
    seedAsyncStorage({ [getGraphLayoutKey(LIST)]: "{not json" });

    await expectNull();
  });

  it("rejects a payload that is not an object", async () => {
    seedAsyncStorage({ [getGraphLayoutKey(LIST)]: JSON.stringify("nope") });

    await expectNull();
  });

  it("rejects a payload with no version", async () => {
    seedAsyncStorage({
      [getGraphLayoutKey(LIST)]: JSON.stringify({ positions: {} }),
    });

    await expectNull();
  });

  it("refuses a layout from a newer build", async () => {
    // Reading it could mean silently dropping fields that build relies on.
    seedAsyncStorage({
      [getGraphLayoutKey(LIST)]: JSON.stringify({
        ...layout,
        version: GRAPH_LAYOUT_VERSION + 1,
      }),
    });

    await expectNull();
  });

  it("rejects positions stored as an array", async () => {
    seedAsyncStorage({
      [getGraphLayoutKey(LIST)]: JSON.stringify({ ...layout, positions: [] }),
    });

    await expectNull();
  });

  it("keeps a layout whose individual entries are malformed", async () => {
    // resolveLayout drops a bad entry and seeds that one node; throwing the
    // whole layout away would cost the user every position they set.
    seedAsyncStorage({
      [getGraphLayoutKey(LIST)]: JSON.stringify({
        ...layout,
        positions: { "1": { x: 1, y: 2 }, "2": "somewhere" },
      }),
    });

    expect(await loadGraphLayout(LIST)).not.toBeNull();
  });
});

describe("clearing", () => {
  it("forgets a list's layout", async () => {
    await saveGraphLayout(LIST, layout);

    await clearGraphLayout(LIST);

    expect(await loadGraphLayout(LIST)).toBeNull();
  });

  it("is harmless when there is nothing to clear", async () => {
    await expect(clearGraphLayout(LIST)).resolves.toBeUndefined();
  });
});

describe("when storage itself fails", () => {
  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  it("propagates a failed save", async () => {
    // Unlike a read, a write that silently did nothing would tell the user
    // their arrangement was saved when it was not.
    jest
      .spyOn(AsyncStorage, "setItem")
      .mockRejectedValueOnce(new Error("disk full"));

    await expect(saveGraphLayout(LIST, layout)).rejects.toThrow("disk full");
  });

  it("propagates a failed clear", async () => {
    jest
      .spyOn(AsyncStorage, "removeItem")
      .mockRejectedValueOnce(new Error("disk full"));

    await expect(clearGraphLayout(LIST)).rejects.toThrow("disk full");
  });

  it("degrades to no layout when a read fails", async () => {
    jest
      .spyOn(AsyncStorage, "getItem")
      .mockRejectedValueOnce(new Error("disk full"));

    await expect(loadGraphLayout(LIST)).resolves.toBeNull();
  });
});

describe("collectOrphanedLayoutKeys", () => {
  it("reclaims a layout whose list is gone", async () => {
    await saveGraphLayout("gone", layout);
    await saveGraphLayout("alive", layout);

    expect(await collectOrphanedLayoutKeys(["alive"])).toBe(1);
    expect(await loadGraphLayout("gone")).toBeNull();
  });

  it("keeps the layouts of live lists", async () => {
    await saveGraphLayout("alive", layout);

    await collectOrphanedLayoutKeys(["alive"]);

    expect(await loadGraphLayout("alive")).toEqual(layout);
  });

  it("reclaims nothing when every list is live", async () => {
    await saveGraphLayout("alive", layout);

    expect(await collectOrphanedLayoutKeys(["alive"])).toBe(0);
  });

  it("leaves other keys alone", async () => {
    seedAsyncStorage({ "@patternLists": "[]" });
    await saveGraphLayout("gone", layout);

    await collectOrphanedLayoutKeys([]);

    expect(peekAsyncStorage()["@patternLists"]).toBe("[]");
  });

  it("reports nothing rather than throwing when storage fails", async () => {
    jest
      .spyOn(AsyncStorage, "getAllKeys")
      .mockRejectedValueOnce(new Error("disk full"));
    jest.spyOn(console, "error").mockImplementation(() => {});

    expect(await collectOrphanedLayoutKeys([])).toBe(0);
  });
});
