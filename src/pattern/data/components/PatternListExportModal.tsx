import React, { useState } from "react";
import { Modal, ScrollView, Switch, Text, View } from "react-native";
import { Button } from "@/src/common/ui";
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
            <Button
              title={t("cancel")}
              variant="secondary"
              onPress={onCancel}
              style={styles.footerButton}
            />
            <Button
              title={`${t("export")} (${stats.selectedCount})`}
              icon="export-variant"
              onPress={handleExport}
              disabled={stats.noneSelected}
              style={styles.footerButton}
            />
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
  footerButton: { flex: 1 },
}));
export default PatternListExportModal;
