import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { IPattern, IPatternList } from "@/src/pattern/types/IPatternList";
import {
  getActiveList,
  hasPatternLists,
  loadPatterns,
  savePatterns,
  setActiveListId,
} from "@/src/pattern/data/PatternListStorage";
import { useSharedList } from "@/src/pattern/data/hooks/useSharedList";
import { useTranslation } from "react-i18next";
import AppDialog from "@/src/common/components/AppDialog";

interface ActivePatternListContextType {
  activeList: IPatternList | null;
  patterns: IPattern[];
  isLoading: boolean;
  setActiveList: (list: IPatternList | null) => Promise<void>;
  updatePatterns: (patterns: IPattern[]) => Promise<void>;
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
  const [activeList, setActiveListState] = useState<IPatternList | null>(null);
  const [patterns, setPatternsState] = useState<IPattern[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLists, setHasLists] = useState(false);
  const { t } = useTranslation();

  // Load active list and patterns on mount
  const loadActiveListAndPatterns = useCallback(async () => {
    setIsLoading(true);
    try {
      const hasAnyLists = await hasPatternLists();
      setHasLists(hasAnyLists);

      const list = await getActiveList();
      setActiveListState(list);

      if (list) {
        const loadedPatterns = await loadPatterns(list.id);
        setPatternsState(loadedPatterns);
      } else {
        setPatternsState([]);
      }
    } catch (_error) {
      setActiveListState(null);
      setPatternsState([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadActiveListAndPatterns();
  }, [loadActiveListAndPatterns]);

  const setActiveList = async (list: IPatternList | null) => {
    try {
      if (list) {
        await setActiveListId(list.id);
        setActiveListState(list);
        const loadedPatterns = await loadPatterns(list.id);
        setPatternsState(loadedPatterns);
      } else {
        setActiveListState(null);
        setPatternsState([]);
      }
    } catch (error) {
      console.error("Error setting active list:", error);
    }
  };

  const updatePatterns = async (newPatterns: IPattern[]) => {
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

  // Live subscription: when the active list has a shareCode, keep it in sync
  // with Firestore. Updates are persisted to AsyncStorage then the state is
  // refreshed, so the user always sees the publisher's latest version.
  const { detachedListName, clearDetachedName } = useSharedList(
    activeList?.shareCode,
    activeList?.id,
    loadActiveListAndPatterns,
  );

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
      <AppDialog
        visible={detachedListName !== null}
        title={t("listUnpublishedTitle")}
        message={
          detachedListName
            ? t("listUnpublishedMessage", { name: detachedListName })
            : ""
        }
        onClose={clearDetachedName}
      />
    </ActivePatternListContext.Provider>
  );
};
