import React, { useState } from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { PatternList } from "@/components/pattern/types/PatternList";
import { getPalette, PaletteColor } from "@/components/common/ColorPalette";
import { useThemeContext } from "@/components/common/ThemeContext";
import { useTranslation } from "react-i18next";
import { PatternListWithPatterns } from "@/components/pattern/data/types/IExportData";

export type ImportAction = "skip" | "replace";
export interface ImportDecision {
  list: PatternList;
  action: ImportAction;
  existingList?: PatternList;
}
interface PatternListImportModalProps {
  visible: boolean;
  importedLists: PatternListWithPatterns[];
  existingLists: PatternList[];
  onImport: (decisions: ImportDecision[]) => void;
  onCancel: () => void;
}
const PatternListImportModal: React.FC<PatternListImportModalProps> = ({
  visible,
  importedLists,
  existingLists,
  onImport,
  onCancel,
}) => {
  const { t } = useTranslation();
  const { colorScheme } = useThemeContext();
  const palette = getPalette(colorScheme);
  const styles = getStyles(palette);
  // Initialize decisions for each imported list
  const [decisions, setDecisions] = useState<Map<string, ImportAction>>(() => {
    const map = new Map<string, ImportAction>();
    importedLists.forEach((list) => {
      const exists = existingLists.some((e) => e.id === list.id);
      map.set(list.id, exists ? "skip" : "replace");
    });
    return map;
  });
  const setAction = (listId: string, action: ImportAction) => {
    setDecisions(new Map(decisions.set(listId, action)));
  };
  const handleImport = () => {
    const importDecisions: ImportDecision[] = importedLists.map((list) => {
      const action = decisions.get(list.id) || "replace";
      const existingList = existingLists.find((e) => e.id === list.id);
      return {
        list,
        action,
        existingList,
      };
    });
    onImport(importDecisions);
  };
  const getConflictCount = () => {
    return importedLists.filter((list) =>
      existingLists.some((e) => e.id === list.id),
    ).length;
  };
  const getTotalPatternsCount = () => {
    return importedLists.reduce((sum, list) => sum + list.patterns.length, 0);
  };
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onCancel}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.title}>{t("importPatternLists")}</Text>
          <Text style={styles.subtitle}>
            {t("foundListsToImport", { count: importedLists.length })}
            {"\n"}
            {getTotalPatternsCount()} {t("patterns")} • {getConflictCount()}{" "}
            {t("conflicts")}
          </Text>
          <ScrollView style={styles.listContainer}>
            {importedLists.map((list) => {
              const existingList = existingLists.find((e) => e.id === list.id);
              const action = decisions.get(list.id) || "replace";
              return (
                <View key={list.id} style={styles.listItem}>
                  <View style={styles.listHeader}>
                    <Text style={styles.listName}>{list.name}</Text>
                    {existingList && (
                      <View style={styles.conflictBadge}>
                        <Text style={styles.conflictBadgeText}>
                          {t("existsLabel")}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.listMeta}>
                    {list.patterns.length} {t("patterns")} • {list.danceStyle}
                  </Text>
                  <View style={styles.actionButtons}>
                    {existingList ? (
                      <>
                        <TouchableOpacity
                          style={[
                            styles.actionButton,
                            action === "skip" && styles.actionButtonSelected,
                          ]}
                          onPress={() => setAction(list.id, "skip")}
                        >
                          <Text
                            style={[
                              styles.actionButtonText,
                              action === "skip" &&
                                styles.actionButtonTextSelected,
                            ]}
                          >
                            {t("skip")}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.actionButton,
                            action === "replace" && styles.actionButtonSelected,
                          ]}
                          onPress={() => setAction(list.id, "replace")}
                        >
                          <Text
                            style={[
                              styles.actionButtonText,
                              action === "replace" &&
                                styles.actionButtonTextSelected,
                            ]}
                          >
                            {t("replace")}
                          </Text>
                        </TouchableOpacity>
                      </>
                    ) : (
                      <View style={styles.newListBadge}>
                        <Text style={styles.newListText}>{t("newList")}</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </ScrollView>
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
              <Text style={styles.cancelButtonText}>{t("cancel")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.importButton}
              onPress={handleImport}
            >
              <Text style={styles.importButtonText}>{t("import")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};
const getStyles = (palette: Record<PaletteColor, string>) =>
  StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
    },
    modalContent: {
      backgroundColor: palette[PaletteColor.Surface],
      borderRadius: 16,
      padding: 24,
      width: "100%",
      maxWidth: 500,
      maxHeight: "80%",
    },
    title: {
      fontSize: 20,
      fontWeight: "bold",
      color: palette[PaletteColor.PrimaryText],
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 14,
      color: palette[PaletteColor.SecondaryText],
      marginBottom: 16,
      lineHeight: 20,
    },
    listContainer: {
      maxHeight: 400,
      marginBottom: 16,
    },
    listItem: {
      padding: 12,
      borderRadius: 8,
      marginBottom: 12,
      backgroundColor: palette[PaletteColor.CardBackground],
      borderWidth: 1,
      borderColor: palette[PaletteColor.Border],
    },
    listHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 4,
    },
    listName: {
      fontSize: 16,
      fontWeight: "600",
      color: palette[PaletteColor.PrimaryText],
      flex: 1,
    },
    conflictBadge: {
      backgroundColor: palette[PaletteColor.Error] + "20",
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 4,
    },
    conflictBadgeText: {
      fontSize: 11,
      color: palette[PaletteColor.Error],
      fontWeight: "600",
    },
    listMeta: {
      fontSize: 12,
      color: palette[PaletteColor.SecondaryText],
      marginBottom: 12,
    },
    actionButtons: {
      flexDirection: "row",
      gap: 8,
    },
    actionButton: {
      flex: 1,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: palette[PaletteColor.Border],
      backgroundColor: palette[PaletteColor.Background],
      alignItems: "center",
    },
    actionButtonSelected: {
      borderColor: palette[PaletteColor.Primary],
      backgroundColor: palette[PaletteColor.Primary],
    },
    actionButtonText: {
      fontSize: 14,
      fontWeight: "600",
      color: palette[PaletteColor.PrimaryText],
    },
    actionButtonTextSelected: {
      color: palette[PaletteColor.Surface],
    },
    newListBadge: {
      backgroundColor: palette[PaletteColor.Accent] + "20",
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 6,
      alignItems: "center",
    },
    newListText: {
      fontSize: 14,
      color: palette[PaletteColor.Accent],
      fontWeight: "600",
    },
    buttonRow: {
      flexDirection: "row",
      gap: 12,
    },
    cancelButton: {
      flex: 1,
      backgroundColor: palette[PaletteColor.Background],
      borderRadius: 8,
      padding: 14,
      alignItems: "center",
      borderWidth: 1,
      borderColor: palette[PaletteColor.Border],
    },
    cancelButtonText: {
      fontSize: 16,
      fontWeight: "600",
      color: palette[PaletteColor.PrimaryText],
    },
    importButton: {
      flex: 1,
      backgroundColor: palette[PaletteColor.Primary],
      borderRadius: 8,
      padding: 14,
      alignItems: "center",
    },
    importButtonText: {
      fontSize: 16,
      fontWeight: "600",
      color: palette[PaletteColor.Surface],
    },
  });
export default PatternListImportModal;
