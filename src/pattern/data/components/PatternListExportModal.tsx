import React, { useState } from "react";
import {
  Modal,
  ScrollView,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { IPatternList } from "@/src/pattern/types/IPatternList";
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
  const { theme } = useUnistyles();
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
          />
          <ScrollView style={styles.listContainer}>
            {patternLists.map((list) => (
              <ExportListItem
                key={list.id}
                list={list}
                isSelected={selectedIds.has(list.id)}
                onToggle={() => toggleSelection(list.id)}
              />
            ))}
          </ScrollView>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>{t("includeVideosInExport")}</Text>
            <Switch
              value={includeVideos}
              onValueChange={setIncludeVideos}
              trackColor={{
                false: theme.colors.textMuted,
                true: theme.colors.primary,
              }}
              thumbColor={theme.colors.border}
            />
          </View>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>{t("exportAsReadonly")}</Text>
            <Switch
              value={exportAsReadonly}
              onValueChange={setExportAsReadonly}
              trackColor={{
                false: theme.colors.textMuted,
                true: theme.colors.primary,
              }}
              thumbColor={theme.colors.border}
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
const styles = StyleSheet.create((theme) => ({
  modalOverlay: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    justifyContent: "center",
    alignItems: "center",
    padding: theme.space.xl,
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    padding: theme.space.xxl,
    width: "100%",
    maxWidth: 500,
    maxHeight: "80%",
  },
  title: {
    ...theme.typography.headline,
    color: theme.colors.text,
    marginBottom: theme.space.lg,
  },
  listContainer: {
    maxHeight: 400,
    marginBottom: theme.space.lg,
  },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: theme.space.md,
    marginBottom: theme.space.md,
  },
  toggleLabel: {
    ...theme.typography.bodySmall,
    color: theme.colors.text,
  },
  buttonRow: {
    flexDirection: "row",
    gap: theme.space.md,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.md,
    padding: theme.space.lg,
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cancelButtonText: {
    ...theme.typography.button,
    color: theme.colors.text,
  },
  exportButton: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    padding: theme.space.lg,
    alignItems: "center",
  },
  exportButtonDisabled: {
    opacity: 0.5,
  },
  exportButtonText: {
    ...theme.typography.button,
    color: theme.colors.onPrimary,
  },
}));
export default PatternListExportModal;
