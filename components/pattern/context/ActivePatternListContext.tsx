import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { Pattern, PatternList } from "@/components/pattern/types/PatternList";
import {
  getActiveList,
  hasPatternLists,
  loadPatterns,
  savePatterns,
  setActiveListId,
} from "@/components/pattern/data/PatternListStorage";

interface ActivePatternListContextType {
  activeList: PatternList | null;
  patterns: Pattern[];
  isLoading: boolean;
  setActiveList: (list: PatternList | null) => Promise<void>;
  updatePatterns: (patterns: Pattern[]) => Promise<void>;
  refreshActiveList: () => Promise<void>;
  hasLists: boolean;
}

const ActivePatternListContext = createContext<
  ActivePatternListContextType | undefined
>(undefined);

export const useActivePatternList = () => {
  const context = useContext(ActivePatternListContext);
  if (!context) {
    throw new Error(
      "useActivePatternList must be used within ActivePatternListProvider",
    );
  }
  return context;
};

export const ActivePatternListProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [activeList, setActiveListState] = useState<PatternList | null>(null);
  const [patterns, setPatternsState] = useState<Pattern[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLists, setHasLists] = useState(false);

  // Load active list and patterns on mount
  const loadActiveListAndPatterns = useCallback(async () => {
    setIsLoading(true);
    try {
      const hasAnyLists = await hasPatternLists();
      console.log("Has any pattern lists:", hasAnyLists);
      setHasLists(hasAnyLists);

      const list = await getActiveList();
      console.log("Active list:", list?.name, list?.id);
      setActiveListState(list);

      if (list) {
        const loadedPatterns = await loadPatterns(list.id);
        console.log("Loaded patterns for list:", loadedPatterns.length);
        setPatternsState(loadedPatterns);
      } else {
        console.log("No active list, clearing patterns");
        setPatternsState([]);
      }
    } catch (error) {
      console.error("Error loading active list:", error);
      setActiveListState(null);
      setPatternsState([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadActiveListAndPatterns();
  }, [loadActiveListAndPatterns]);

  const setActiveList = async (list: PatternList | null) => {
    try {
      if (list) {
        console.log("Setting active list:", list.name, list.id);
        await setActiveListId(list.id);
        setActiveListState(list);
        const loadedPatterns = await loadPatterns(list.id);
        console.log(
          "Loaded patterns after setting active:",
          loadedPatterns.length,
        );
        setPatternsState(loadedPatterns);
      } else {
        console.log("Clearing active list");
        setActiveListState(null);
        setPatternsState([]);
      }
    } catch (error) {
      console.error("Error setting active list:", error);
    }
  };

  const updatePatterns = async (newPatterns: Pattern[]) => {
    if (!activeList) return;

    try {
      await savePatterns(activeList.id, newPatterns);
      setPatternsState(newPatterns);
    } catch (error) {
      console.error("Error updating patterns:", error);
    }
  };

  const refreshActiveList = async () => {
    await loadActiveListAndPatterns();
  };

  const value: ActivePatternListContextType = {
    activeList,
    patterns,
    isLoading,
    setActiveList,
    updatePatterns,
    refreshActiveList,
    hasLists,
  };

  return (
    <ActivePatternListContext.Provider value={value}>
      {children}
    </ActivePatternListContext.Provider>
  );
};
