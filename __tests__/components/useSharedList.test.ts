import { act, renderHook, waitFor } from "@testing-library/react-native";
import { subscribeToSharedList } from "@/src/firebase/FirebaseListService";
import { useSharedList } from "@/src/pattern/data/hooks/useSharedList";
import {
  getPatternListById,
  loadPatterns,
  savePatternList,
  savePatterns,
} from "@/src/pattern/data/PatternListStorage";
import { PatternListWithPatterns } from "@/src/pattern/data/types/IExportData";
import {
  createTestPattern,
  createTestPatternList,
} from "@/utils/testFactories";

jest.mock("@/src/firebase/FirebaseListService", () => ({
  ...jest.requireActual("@/src/firebase/FirebaseListService"),
  subscribeToSharedList: jest.fn(),
}));
jest.mock("@/src/firebase/SubscriptionService", () => ({
  refreshSubscription: jest.fn(() => Promise.resolve()),
  removeSubscription: jest.fn(() => Promise.resolve()),
}));

const mocked = subscribeToSharedList as jest.MockedFunction<
  typeof subscribeToSharedList
>;

/** Two lists this phone follows, from two publishers. */
async function seed() {
  const a = createTestPatternList({
    name: "A",
    shareCode: "AAAA1111",
    readonly: true,
  });
  const b = createTestPatternList({
    name: "B",
    shareCode: "BBBB2222",
    readonly: true,
  });
  await savePatternList(a);
  await savePatternList(b);
  const typeId = b.patternTypes[0].id;
  await savePatterns(b.id, [
    createTestPattern(typeId, { id: 1, name: "Whip" }),
  ]);
  return { a, b };
}

/** Subscribes to [list] and returns what the hook hands updates to. */
function follow(list: { id: string; shareCode?: string }) {
  let onUpdate!: (l: PatternListWithPatterns) => void;
  mocked.mockImplementation((_code, update) => {
    onUpdate = update;
    return () => {};
  });
  const onUpdated = jest.fn();
  renderHook(() => useSharedList(list.shareCode, list.id, onUpdated));
  return { onUpdate: (l: PatternListWithPatterns) => onUpdate(l), onUpdated };
}

describe("useSharedList", () => {
  it("takes an update of the list it follows", async () => {
    const { a } = await seed();
    const { onUpdate, onUpdated } = follow(a);

    await act(async () =>
      onUpdate({ ...a, readonly: undefined, name: "A, renamed", patterns: [] }),
    );

    await waitFor(() => expect(onUpdated).toHaveBeenCalled());
    expect((await getPatternListById(a.id))?.name).toBe("A, renamed");
  });

  it("never writes another list that the update names", async () => {
    // Publisher A copies B's list id into their own document.
    const { a, b } = await seed();
    const { onUpdate, onUpdated } = follow(a);

    await act(async () =>
      onUpdate({
        ...a,
        id: b.id,
        readonly: undefined,
        name: "Hijacked",
        patterns: [],
      }),
    );

    expect(onUpdated).not.toHaveBeenCalled();
    expect((await getPatternListById(b.id))?.name).toBe("B");
    expect((await getPatternListById(b.id))?.shareCode).toBe("BBBB2222");
    expect((await loadPatterns(b.id)).map((p) => p.name)).toEqual(["Whip"]);
  });
});
