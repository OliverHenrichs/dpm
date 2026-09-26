import React from "react";
import { Modal, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
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
  const { decisions, setAction, getImportDecisions, stats } =
    useImportDecisions({
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
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.title}>{t("importPatternLists")}</Text>
          <ImportSummary
            totalLists={stats.totalLists}
            totalPatterns={stats.totalPatternsCount}
            conflictCount={stats.conflictCount}
          />
          <ScrollView style={styles.listContainer}>
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
                />
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
  importButton: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    padding: theme.space.lg,
    alignItems: "center",
  },
  importButtonText: {
    ...theme.typography.button,
    color: theme.colors.onPrimary,
  },
}));
export default PatternListImportModal;
