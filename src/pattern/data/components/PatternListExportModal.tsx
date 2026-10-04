import React, { useState } from "react";
import { Modal, ScrollView, Switch, Text, View } from "react-native";
import ModalOverlay from "@/src/common/components/ModalOverlay";
import { Button } from "@/src/common/ui";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { IPatternList } from "@/src/pattern/types/IPatternList";
import { useTranslation } from "react-i18next";
import { PatternListWithPatterns } from "@/src/pattern/data/types/IExportData";
import { useExportSelection } from "@/src/pattern/data/hooks/useExportSelection";
import { SelectAllButton } from "@/src/pattern/data/components/SelectAllButton";
import { ExportListItem } from "@/src/pattern/data/components/ExportListItem";
import { ExportOptions } from "@/src/pattern/data/exportPatterns";
import { hasTranscripts } from "@/src/pattern/data/transcripts";

interface PatternListExportModalProps {
  visible: boolean;
  patternLists: PatternListWithPatterns[];
  onExport: (selectedLists: IPatternList[], options: ExportOptions) => void;
  onCancel: () => void;
}
/**
 * Settings mounts this permanently and toggles `visible`, so the body is mounted per opening:
 * the selection is then taken from the lists as they are now — all of them — and the options
 * start from their defaults. Taken once at the first mount, it saw no lists yet and opened with
 * nothing selected (see src/pattern/list/AGENTS.md, "Always-mounted modals").
 */
const PatternListExportModal: React.FC<PatternListExportModalProps> = ({
  visible,
  onCancel,
  ...rest
}) => (
  <Modal
    visible={visible}
    animationType="slide"
    transparent={true}
    onRequestClose={onCancel}
  >
    {visible && <ExportSheet onCancel={onCancel} {...rest} />}
  </Modal>
);

const ExportSheet: React.FC<Omit<PatternListExportModalProps, "visible">> = ({
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
  // Off unless chosen, every time (L4): a transcript is someone's words in writing.
  const [includeTranscripts, setIncludeTranscripts] = useState(false);
  // Offered only when there is something to include; it rides on the videos, so it needs them.
  const offerTranscripts = hasTranscripts(
    patternLists
      .filter((list) => selectedIds.has(list.id))
      .flatMap((list) => list.patterns),
  );
  const handleExport = () => {
    onExport(getSelectedLists(), {
      includeVideos,
      exportAsReadonly,
      includeTranscripts:
        offerTranscripts && includeVideos && includeTranscripts,
    });
  };
  return (
    <ModalOverlay>
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
        {offerTranscripts && (
          <>
            <View style={styles.toggleRow}>
              <Text
                style={[
                  styles.toggleLabel,
                  !includeVideos && styles.disabledLabel,
                ]}
              >
                {t("includeTranscriptsInExport")}
              </Text>
              <Switch
                value={includeVideos && includeTranscripts}
                onValueChange={setIncludeTranscripts}
                disabled={!includeVideos}
                accessibilityLabel={t("includeTranscriptsInExport")}
                trackColor={{
                  false: theme.colors.textMuted,
                  true: theme.colors.primary,
                }}
                thumbColor={theme.colors.border}
              />
            </View>
            <Text style={styles.toggleHint}>
              {t(
                includeVideos
                  ? "includeTranscriptsHint"
                  : "includeTranscriptsNeedsVideos",
              )}
            </Text>
          </>
        )}
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
    </ModalOverlay>
  );
};
const styles = StyleSheet.create((theme) => ({
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
  disabledLabel: { color: theme.colors.textMuted },
  toggleHint: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    // Belongs to the switch above: pulled up into that row's bottom margin.
    marginTop: -theme.space.md,
    marginBottom: theme.space.md,
  },
  buttonRow: {
    flexDirection: "row",
    gap: theme.space.md,
  },
  footerButton: { flex: 1 },
}));
export default PatternListExportModal;
