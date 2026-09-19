import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  clearAllData,
  deletePatternList,
  getActiveList,
  getActiveListId,
  hasPatternLists,
  loadAllPatternLists,
  loadPatterns,
  savePatternList,
  savePatterns,
  setActiveListId,
} from "@/src/pattern/data/PatternListStorage";
import {
  createTestPattern,
  createTestPatternList,
} from "@/utils/testFactories";

// Mock AsyncStorage
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  removeMany: jest.fn(),
}));

describe("PatternListStorage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("loadAllPatternLists", () => {
    it("should return empty array when no lists exist", async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      const result = await loadAllPatternLists();
      expect(result).toEqual([]);
    });

    it("should return parsed pattern lists", async () => {
      const lists = [createTestPatternList(), createTestPatternList()];
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(lists),
      );
      const result = await loadAllPatternLists();
      expect(result).toHaveLength(2);
    });

    it("should return empty array on error", async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(
        new Error("Storage error"),
      );
      const result = await loadAllPatternLists();
      expect(result).toEqual([]);
    });
  });

  describe("savePatternList", () => {
    it("should add new pattern list", async () => {
      const list = createTestPatternList();
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify([]));

      await savePatternList(list);

      expect(AsyncStorage.setItem).toHaveBeenCalled();
      const savedData = JSON.parse(
        (AsyncStorage.setItem as jest.Mock).mock.calls[0][1],
      );
      expect(savedData).toHaveLength(1);
      expect(savedData[0].id).toBe(list.id);
    });

    it("should update existing pattern list", async () => {
      const list = createTestPatternList();
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify([list]),
      );

      const updatedList = { ...list, name: "Updated Name" };
      await savePatternList(updatedList);

      const savedData = JSON.parse(
        (AsyncStorage.setItem as jest.Mock).mock.calls[0][1],
      );
      expect(savedData).toHaveLength(1);
      expect(savedData[0].name).toBe("Updated Name");
      expect(savedData[0].updatedAt).toBeGreaterThanOrEqual(list.updatedAt);
    });
  });

  describe("deletePatternList", () => {
    it("should remove pattern list and its patterns", async () => {
      const list1 = createTestPatternList();
      const list2 = createTestPatternList();
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify([list1, list2]),
      );

      await deletePatternList(list1.id);

      const savedData = JSON.parse(
        (AsyncStorage.setItem as jest.Mock).mock.calls[0][1],
      );
      expect(savedData).toHaveLength(1);
      expect(savedData[0].id).toBe(list2.id);
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(
        `@patterns_${list1.id}`,
      );
    });

    it("should clear active list if deleted", async () => {
      const list = createTestPatternList();
      (AsyncStorage.getItem as jest.Mock)
        .mockResolvedValueOnce(JSON.stringify([list]))
        .mockResolvedValueOnce(list.id);

      await deletePatternList(list.id);

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith("@activeListId");
    });
  });

  describe("Active list management", () => {
    it("should get and set active list ID", async () => {
      const listId = "test-id";

      await setActiveListId(listId);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        "@activeListId",
        listId,
      );

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(listId);
      const result = await getActiveListId();
      expect(result).toBe(listId);
    });

    it("should get active list", async () => {
      const list = createTestPatternList();
      (AsyncStorage.getItem as jest.Mock)
        .mockResolvedValueOnce(list.id)
        .mockResolvedValueOnce(JSON.stringify([list]));

      const result = await getActiveList();
      expect(result).toEqual(list);
    });
  });

  describe("Pattern management", () => {
    it("should load patterns for a list", async () => {
      const listId = "test-list-id";
      const patterns = [
        createTestPattern("type1", { id: 1 }),
        createTestPattern("type2", { id: 2 }),
      ];
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(patterns),
      );

      const result = await loadPatterns(listId);
      expect(result).toHaveLength(2);
      expect(AsyncStorage.getItem).toHaveBeenCalledWith(`@patterns_${listId}`);
    });

    it("should save patterns for a list", async () => {
      const listId = "test-list-id";
      const patterns = [createTestPattern("type1", { id: 1 })];

      await savePatterns(listId, patterns);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        `@patterns_${listId}`,
        JSON.stringify(patterns),
      );
    });
  });

  describe("hasPatternLists", () => {
    it("should return true when lists exist", async () => {
      const lists = [createTestPatternList()];
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(lists),
      );

      const result = await hasPatternLists();
      expect(result).toBe(true);
    });

    it("should return false when no lists exist", async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const result = await hasPatternLists();
      expect(result).toBe(false);
    });
  });

  describe("clearAllData", () => {
    it("should remove all storage keys", async () => {
      await clearAllData();

      expect(AsyncStorage.removeMany).toHaveBeenCalledWith([
        "@patternLists",
        "@activeListId",
      ]);
    });
  });
});
