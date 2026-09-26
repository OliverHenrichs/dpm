import React from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { IPatternList } from "@/src/pattern/types/IPatternList";
import { getPalette, PaletteColor } from "@/src/common/utils/ColorPalette";
import { useThemeContext } from "@/src/common/components/ThemeContext";
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
  const { colorScheme } = useThemeContext();
  const palette = getPalette(colorScheme);
  const styles = getStyles(palette);
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
            palette={palette}
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
                  palette={palette}
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
const getStyles = (palette: Record<PaletteColor, string>) =>
  StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: palette[PaletteColor.Overlay],
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
      color: palette[PaletteColor.Text],
      marginBottom: 8,
    },
    listContainer: {
      maxHeight: 400,
      marginBottom: 16,
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
      color: palette[PaletteColor.Text],
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
      color: palette[PaletteColor.OnPrimary],
    },
  });
export default PatternListImportModal;
