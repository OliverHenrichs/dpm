import React from "react";
import { Modal, Text, View } from "react-native";
import RevealScrollView from "@/src/common/components/RevealScrollView";
import ModalOverlay from "@/src/common/components/ModalOverlay";
import { Button } from "@/src/common/ui";
import { StyleSheet } from "react-native-unistyles";
import { getCommonDialogCard } from "@/src/common/utils/CommonStyles";
import { IPatternList } from "@/src/pattern/types/IPatternList";
import { useTranslation } from "react-i18next";
import { PatternListWithPatterns } from "@/src/pattern/data/types/IExportData";
import {
  ImportDecision,
  useImportDecisions,
} from "@/src/pattern/data/hooks/useImportDecisions";
import { ImportSummary } from "@/src/pattern/data/components/ImportSummary";
import { ImportListItem } from "@/src/pattern/data/components/ImportListItem";

export type {
  ImportAction,
  ImportDecision,
} from "@/src/pattern/data/hooks/useImportDecisions";

interface PatternListImportModalProps {
  visible: boolean;
  importedLists: PatternListWithPatterns[];
  existingLists: IPatternList[];
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
  const {
    decisions,
    setAction,
    nameFieldOf,
    nameOf,
    setName,
    getImportDecisions,
    stats,
  } = useImportDecisions({
    importedLists,
    existingLists,
  });
  const handleImport = () => {
    onImport(getImportDecisions());
  };
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onCancel}
    >
      <ModalOverlay>
        <View style={styles.modalContent}>
          <Text style={styles.title}>{t("importPatternLists")}</Text>
          <ImportSummary
            totalLists={stats.totalLists}
            totalPatterns={stats.totalPatternsCount}
            conflictCount={stats.conflictCount}
          />
          <RevealScrollView
            style={styles.listContainer}
            keyboardShouldPersistTaps="handled"
          >
            {importedLists.map((list) => {
              const existingList = existingLists.find((e) => e.id === list.id);
              const currentAction = decisions.get(list.id) || "replace";
              return (
                <ImportListItem
                  key={list.id}
                  list={list}
                  existingList={existingList}
                  currentAction={currentAction}
                  onActionChange={(action) => setAction(list.id, action)}
                  showName={nameFieldOf(list) !== null}
                  name={nameOf(list)}
                  onNameChange={(name) => setName(list.id, name)}
                />
              );
            })}
          </RevealScrollView>
          <View style={styles.buttonRow}>
            <Button
              title={t("cancel")}
              variant="secondary"
              onPress={onCancel}
              style={styles.footerButton}
            />
            <Button
              title={t("import")}
              icon="import"
              onPress={handleImport}
              style={styles.footerButton}
            />
          </View>
        </View>
      </ModalOverlay>
    </Modal>
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
    marginBottom: theme.space.sm,
  },
  listContainer: {
    maxHeight: 400,
    marginBottom: theme.space.lg,
  },
  buttonRow: {
    flexDirection: "row",
    gap: theme.space.md,
  },
  footerButton: { flex: 1 },
}));
export default PatternListImportModal;
