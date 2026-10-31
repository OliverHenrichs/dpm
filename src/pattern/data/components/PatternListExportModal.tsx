import React, { useState } from "react";
import { Modal, ScrollView, Text, View } from "react-native";
import ModalOverlay from "@/src/common/components/ModalOverlay";
import { Button, SwitchRow } from "@/src/common/ui";
import { StyleSheet } from "react-native-unistyles";
import { getCommonDialogCard } from "@/src/common/utils/CommonStyles";
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
        <SwitchRow
          title={t("includeVideosInExport")}
          value={includeVideos}
          onValueChange={setIncludeVideos}
          style={styles.toggle}
        />
        {offerTranscripts && (
          <SwitchRow
            title={t("includeTranscriptsInExport")}
            description={t(
              includeVideos
                ? "includeTranscriptsHint"
                : "includeTranscriptsNeedsVideos",
            )}
            value={includeVideos && includeTranscripts}
            onValueChange={setIncludeTranscripts}
            disabled={!includeVideos}
            style={styles.toggle}
          />
        )}
        <SwitchRow
          title={t("exportAsReadonly")}
          value={exportAsReadonly}
          onValueChange={setExportAsReadonly}
          style={styles.toggle}
        />
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
    ...getCommonDialogCard(theme),
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
  toggle: { marginBottom: theme.space.md },
  buttonRow: {
    flexDirection: "row",
    gap: theme.space.md,
  },
  footerButton: { flex: 1 },
}));
export default PatternListExportModal;
