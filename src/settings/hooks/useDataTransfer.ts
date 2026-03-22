import { useCallback, useState } from "react";
import { Alert } from "react-native";
import { useTranslation } from "react-i18next";
import { useFocusEffect } from "@react-navigation/native";
import { exportPatternLists } from "@/src/pattern/data/exportPatterns";
import { importPatternLists } from "@/src/pattern/data/ImportPatterns";
import { ImportDecision } from "@/src/pattern/data/components/PatternListImportModal";
import {
  loadAllPatternLists,
  loadPatterns,
  savePatternList,
  savePatterns,
} from "@/src/pattern/data/PatternListStorage";
import { IPatternList } from "@/src/pattern/types/IPatternList";
import { PatternListWithPatterns } from "@/src/pattern/data/types/IExportData";

export const useDataTransfer = () => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [patternLists, setPatternLists] = useState<PatternListWithPatterns[]>(
    [],
  );
  const [importedLists, setImportedLists] = useState<PatternListWithPatterns[]>(
    [],
  );

  // Load pattern lists whenever the screen is focused
  const loadPatternLists = useCallback(async () => {
    try {
      const lists = await loadAllPatternLists();
      const listsWithPatterns: PatternListWithPatterns[] = await Promise.all(
        lists.map(async (list: IPatternList) => {
          const patterns = await loadPatterns(list.id);
          return { ...list, patterns };
        }),
      );
      setPatternLists(listsWithPatterns);
    } catch (error) {
      Alert.alert(
        t("error"),
        `Failed to load pattern lists: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      loadPatternLists();
    }, [loadPatternLists]),
  );

  const handleExportButtonPress = useCallback(() => {
    if (patternLists.length === 0) {
      Alert.alert(t("error"), t("noPatternListsToExport"));
      return;
    }
    setShowExportModal(true);
  }, [patternLists, t]);

  const handleExport = useCallback(
    async (
      selectedLists: IPatternList[],
      includeVideos: boolean,
      exportAsReadonly: boolean,
    ) => {
      setShowExportModal(false);
      setIsLoading(true);
      try {
        const result = await exportPatternLists(
          selectedLists as PatternListWithPatterns[],
          includeVideos,
          exportAsReadonly,
        );
        // Only show alert for errors, not success (since native share API doesn't report cancellation)
        if (!result.success) {
          Alert.alert(t("error"), result.message);
        }
      } catch (error) {
        Alert.alert(
          t("error"),
          `Export failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      } finally {
        setIsLoading(false);
      }
    },
    [t],
  );

  const handleImportButtonPress = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await importPatternLists();
      if (result.cancelled) {
        // User cancelled file selection, silently return
        return;
      }
      if (result.success && result.patternLists) {
        setImportedLists(result.patternLists);
        setShowImportModal(true);
      } else {
        Alert.alert(t("error"), result.message);
      }
    } catch (error) {
      Alert.alert(
        t("error"),
        `Import failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  const handleImport = useCallback(
    async (decisions: ImportDecision[]) => {
      setShowImportModal(false);
      setIsLoading(true);
      try {
        let importedCount = 0;
        let skippedCount = 0;
        for (const decision of decisions) {
          if (decision.action === "skip") {
            skippedCount++;
            continue;
          }
          // Save the pattern list
          const listToSave = decision.list as PatternListWithPatterns;
          await savePatternList(listToSave);
          // Save all patterns in the list
          await savePatterns(listToSave.id, listToSave.patterns);
          importedCount++;
        }
        await loadPatternLists();
        Alert.alert(
          t("success"),
          `Imported ${importedCount} list(s), skipped ${skippedCount}`,
        );
      } catch (error) {
        Alert.alert(
          t("error"),
          `Import failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      } finally {
        setIsLoading(false);
      }
    },
    [loadPatternLists, t],
  );

  return {
    isLoading,
    showExportModal,
    setShowExportModal,
    showImportModal,
    setShowImportModal,
    patternLists,
    importedLists,
    handleExportButtonPress,
    handleExport,
    handleImportButtonPress,
    handleImport,
  };
};
