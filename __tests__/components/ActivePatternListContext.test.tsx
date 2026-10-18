import AsyncStorage from "@react-native-async-storage/async-storage";
import { useActivePatternList } from "@/src/pattern/data/components/ActivePatternListContext";
import {
  createTestPattern,
  createTestPatternList,
} from "@/utils/testFactories";
import {
  act,
  renderHookWithProviders,
  waitFor,
} from "@/utils/renderWithProviders";

describe("ActivePatternListProvider", () => {
  afterEach(() => jest.restoreAllMocks());

  it("keeps showing the old list until the new list's patterns are loaded", async () => {
    const first = createTestPatternList({ name: "First" });
    const second = createTestPatternList({ name: "Second" });
    const { result } = renderHookWithProviders(() => useActivePatternList(), {
      lists: [first, second],
      patterns: {
        [first.id]: [createTestPattern(first.patternTypes[0].id, { id: 1 })],
        [second.id]: [createTestPattern(second.patternTypes[0].id, { id: 2 })],
      },
    });
    await waitFor(() => expect(result.current.patterns).toHaveLength(1));

    // Hold the new list's patterns back, as a slow storage read on a phone does.
    let release = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    const getItem = AsyncStorage.getItem.bind(AsyncStorage);
    jest.spyOn(AsyncStorage, "getItem").mockImplementation(async (key) => {
      if (key === `@patterns_${second.id}`) await gate;
      return getItem(key);
    });

    let switching: Promise<void> = Promise.resolve();
    await act(async () => {
      switching = result.current.setActiveList(second);
    });

    // Still the old list with its own patterns, never the new list with old ones,
    // whose types it lacks.
    expect(result.current.activeList?.id).toBe(first.id);
    expect(result.current.patterns.map((p) => p.id)).toEqual([1]);

    await act(async () => {
      release();
      await switching;
    });
    expect(result.current.activeList?.id).toBe(second.id);
    expect(result.current.patterns.map((p) => p.id)).toEqual([2]);
  });
});
