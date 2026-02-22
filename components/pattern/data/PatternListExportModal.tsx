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

interface PatternListExportModalProps {
  visible: boolean;
  patternLists: PatternListWithPatterns[];
  onExport: (selectedLists: PatternList[]) => void;
  onCancel: () => void;
}
const PatternListExportModal: React.FC<PatternListExportModalProps> = ({
  visible,
  patternLists,
  onExport,
  onCancel,
}) => {
  const { t } = useTranslation();
  const { colorScheme } = useThemeContext();
  const palette = getPalette(colorScheme);
  const styles = getStyles(palette);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(patternLists.map((l) => l.id)),
  );
  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };
  const toggleSelectAll = () => {
    if (selectedIds.size === patternLists.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(patternLists.map((l) => l.id)));
    }
  };
  const handleExport = () => {
    const selectedLists = patternLists.filter((l) => selectedIds.has(l.id));
    onExport(selectedLists);
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
          <Text style={styles.title}>{t("selectListsToExport")}</Text>
          <TouchableOpacity
            style={styles.selectAllButton}
            onPress={toggleSelectAll}
          >
            <Text style={styles.selectAllText}>
              {selectedIds.size === patternLists.length
                ? t("deselectAll")
                : t("selectAll")}
            </Text>
          </TouchableOpacity>
          <ScrollView style={styles.listContainer}>
            {patternLists.map((list) => (
              <TouchableOpacity
                key={list.id}
                style={[
                  styles.listItem,
                  selectedIds.has(list.id) && styles.listItemSelected,
                ]}
                onPress={() => toggleSelection(list.id)}
              >
                <View style={styles.checkbox}>
                  {selectedIds.has(list.id) && (
                    <Text style={styles.checkmark}>✓</Text>
                  )}
                </View>
                <View style={styles.listInfo}>
                  <Text style={styles.listName}>{list.name}</Text>
                  <Text style={styles.listMeta}>
                    {list.patterns.length} {t("patterns")} • {list.danceStyle}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
              <Text style={styles.cancelButtonText}>{t("cancel")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.exportButton,
                selectedIds.size === 0 && styles.exportButtonDisabled,
              ]}
              onPress={handleExport}
              disabled={selectedIds.size === 0}
            >
              <Text style={styles.exportButtonText}>
                {t("export")} ({selectedIds.size})
              </Text>
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
      marginBottom: 16,
    },
    selectAllButton: {
      alignSelf: "flex-end",
      paddingVertical: 8,
      paddingHorizontal: 12,
      marginBottom: 12,
    },
    selectAllText: {
      fontSize: 14,
      fontWeight: "600",
      color: palette[PaletteColor.Primary],
    },
    listContainer: {
      maxHeight: 400,
      marginBottom: 16,
    },
    listItem: {
      flexDirection: "row",
      alignItems: "center",
      padding: 12,
      borderRadius: 8,
      marginBottom: 8,
      backgroundColor: palette[PaletteColor.CardBackground],
      borderWidth: 2,
      borderColor: "transparent",
    },
    listItemSelected: {
      borderColor: palette[PaletteColor.Primary],
      backgroundColor: palette[PaletteColor.Primary] + "15",
    },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: 4,
      borderWidth: 2,
      borderColor: palette[PaletteColor.Border],
      marginRight: 12,
      justifyContent: "center",
      alignItems: "center",
    },
    checkmark: {
      color: palette[PaletteColor.Primary],
      fontSize: 18,
      fontWeight: "bold",
    },
    listInfo: {
      flex: 1,
    },
    listName: {
      fontSize: 16,
      fontWeight: "600",
      color: palette[PaletteColor.PrimaryText],
      marginBottom: 4,
    },
    listMeta: {
      fontSize: 12,
      color: palette[PaletteColor.SecondaryText],
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
    exportButton: {
      flex: 1,
      backgroundColor: palette[PaletteColor.Primary],
      borderRadius: 8,
      padding: 14,
      alignItems: "center",
    },
    exportButtonDisabled: {
      opacity: 0.5,
    },
    exportButtonText: {
      fontSize: 16,
      fontWeight: "600",
      color: palette[PaletteColor.Surface],
    },
  });
export default PatternListExportModal;
