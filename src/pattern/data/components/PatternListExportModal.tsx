import React, { useState } from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { IPatternList } from "@/src/pattern/types/IPatternList";
import { getPalette, PaletteColor } from "@/src/common/utils/ColorPalette";
import { useThemeContext } from "@/src/common/components/ThemeContext";
import { useTranslation } from "react-i18next";
import { PatternListWithPatterns } from "@/src/pattern/data/types/IExportData";
import { useExportSelection } from "@/src/pattern/data/hooks/useExportSelection";
import { SelectAllButton } from "@/src/pattern/data/components/SelectAllButton";
import { ExportListItem } from "@/src/pattern/data/components/ExportListItem";

interface PatternListExportModalProps {
  visible: boolean;
  patternLists: PatternListWithPatterns[];
  onExport: (
    selectedLists: IPatternList[],
    includeVideos: boolean,
    exportAsReadonly: boolean,
  ) => void;
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
  const {
    selectedIds,
    toggleSelection,
    toggleSelectAll,
    getSelectedLists,
    stats,
  } = useExportSelection({ patternLists });
  const [includeVideos, setIncludeVideos] = useState(true);
  const [exportAsReadonly, setExportAsReadonly] = useState(false);
  const handleExport = () => {
    onExport(getSelectedLists(), includeVideos, exportAsReadonly);
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
          <SelectAllButton
            allSelected={stats.allSelected}
            onToggle={toggleSelectAll}
            palette={palette}
          />
          <ScrollView style={styles.listContainer}>
            {patternLists.map((list) => (
              <ExportListItem
                key={list.id}
                list={list}
                isSelected={selectedIds.has(list.id)}
                onToggle={() => toggleSelection(list.id)}
                palette={palette}
              />
            ))}
          </ScrollView>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>{t("includeVideosInExport")}</Text>
            <Switch
              value={includeVideos}
              onValueChange={setIncludeVideos}
              trackColor={{
                false: palette[PaletteColor.SecondaryText],
                true: palette[PaletteColor.Primary],
              }}
              thumbColor={palette[PaletteColor.Border]}
            />
          </View>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>{t("exportAsReadonly")}</Text>
            <Switch
              value={exportAsReadonly}
              onValueChange={setExportAsReadonly}
              trackColor={{
                false: palette[PaletteColor.SecondaryText],
                true: palette[PaletteColor.Primary],
              }}
              thumbColor={palette[PaletteColor.Border]}
            />
          </View>
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
              <Text style={styles.cancelButtonText}>{t("cancel")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.exportButton,
                stats.noneSelected && styles.exportButtonDisabled,
              ]}
              onPress={handleExport}
              disabled={stats.noneSelected}
            >
              <Text style={styles.exportButtonText}>
                {t("export")} ({stats.selectedCount})
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
    listContainer: {
      maxHeight: 400,
      marginBottom: 16,
    },
    toggleRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 10,
      marginBottom: 12,
    },
    toggleLabel: {
      fontSize: 15,
      color: palette[PaletteColor.PrimaryText],
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
