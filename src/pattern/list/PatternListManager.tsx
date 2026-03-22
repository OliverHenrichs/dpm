import React, { useState } from "react";
import { Modal, ScrollView, StyleSheet, Text, View } from "react-native";
import { IPattern, NewPattern } from "@/src/pattern/types/IPatternList";
import PatternList from "@/src/pattern/list/PatternList";
import EditPatternForm from "@/src/pattern/list/EditPatternForm";
import AppHeader from "@/src/common/components/AppHeader";
import PageContainer from "@/src/common/components/PageContainer";
import { useThemeContext } from "@/src/common/components/ThemeContext";
import { getPalette, PaletteColor } from "@/src/common/utils/ColorPalette";
import { getCommonListContainer } from "@/src/common/utils/CommonStyles";
import { useActivePatternList } from "@/src/pattern/data/components/ActivePatternListContext";
import { useTranslation } from "react-i18next";
import { syncPublishedList } from "@/src/firebase/FirebaseListService";

function createNewId(patterns: IPattern[]) {
  // Simple id generation by finding the max existing id and adding 1
  return patterns.length > 0 ? Math.max(...patterns.map((p) => p.id)) + 1 : 1;
}

const PatternListManager = () => {
  const { t } = useTranslation();
  const { colorScheme } = useThemeContext();
  const palette = getPalette(colorScheme);
  const { activeList, patterns, updatePatterns } = useActivePatternList();

  const [selectedPattern, setSelectedPattern] = useState<IPattern | undefined>(
    undefined,
  );
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const styles = getStyles(palette);

  const patternTypes = activeList?.patternTypes || [];
  const isReadonly = !!activeList?.readonly;

  const addPattern = async (pattern: NewPattern) => {
    if (isReadonly || !pattern.name.trim()) return;

    const newPattern: IPattern = {
      ...pattern,
      id: createNewId(patterns),
    };

    const updated = [...patterns, newPattern];
    await updatePatterns(updated);
    if (activeList?.shareCode) {
      syncPublishedList(activeList, updated).catch(() => {});
    }
    setIsAddingNew(false);
  };

  const editPattern = async (pattern: NewPattern | IPattern) => {
    if (isReadonly || !pattern.name.trim()) return;

    // If it's a NewPattern (no id), this shouldn't happen in edit mode
    if (!("id" in pattern)) {
      console.error("Cannot edit pattern without id");
      return;
    }

    const updatedPatterns = patterns.map((p) =>
      p.id === pattern.id ? (pattern as IPattern) : p,
    );

    await updatePatterns(updatedPatterns);
    if (activeList?.shareCode) {
      syncPublishedList(activeList, updatedPatterns).catch(() => {});
    }
    setIsEditing(false);
  };

  const deletePattern = async (id?: number) => {
    if (isReadonly) return;
    const updatedPatterns = patterns.filter((p) => p.id !== id);
    await updatePatterns(updatedPatterns);
    if (activeList?.shareCode) {
      syncPublishedList(activeList, updatedPatterns).catch(() => {});
    }
    if (selectedPattern?.id === id) setSelectedPattern(undefined);
  };

  const handleEditPattern = (pattern: IPattern) => {
    setSelectedPattern(pattern);
    setIsEditing(true);
  };

  // Show empty state if no active list
  if (!activeList) {
    return (
      <View style={{ flex: 1 }}>
        <PageContainer
          style={{ backgroundColor: palette[PaletteColor.Background] }}
        >
          <AppHeader />
          <View style={styles.emptyStateContainer}>
            <Text style={styles.emptyStateText}>{t("noPatternLists")}</Text>
            <Text style={styles.emptyStateSubtext}>
              {t("noPatternListsHint")}
            </Text>
          </View>
        </PageContainer>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <PageContainer
        style={{ backgroundColor: palette[PaletteColor.Background] }}
      >
        <AppHeader />
        <Modal
          visible={isAddingNew}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setIsAddingNew(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
                <EditPatternForm
                  patterns={patterns}
                  patternTypes={patternTypes}
                  onAccepted={addPattern}
                  onCancel={() => setIsAddingNew(false)}
                />
              </ScrollView>
            </View>
          </View>
        </Modal>
        <Modal
          visible={isEditing && selectedPattern != null}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setIsEditing(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
                <EditPatternForm
                  patterns={patterns}
                  patternTypes={patternTypes}
                  onAccepted={editPattern}
                  onCancel={() => setIsEditing(false)}
                  existing={selectedPattern}
                />
              </ScrollView>
            </View>
          </View>
        </Modal>
        <View style={styles.contentContainer}>
          <PatternList
            patterns={patterns}
            patternTypes={patternTypes}
            isReadonly={isReadonly}
            onSelect={(p) => setSelectedPattern(p as IPattern | undefined)}
            onDelete={deletePattern}
            onAdd={() => setIsAddingNew(!isAddingNew)}
            onEdit={handleEditPattern}
            selectedPattern={selectedPattern}
          />
        </View>
      </PageContainer>
    </View>
  );
};

const getStyles = (palette: Record<PaletteColor, string>) =>
  StyleSheet.create({
    contentContainer: {
      ...getCommonListContainer(palette),
      flex: 1,
    },
    container: {
      flex: 1,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.3)",
      justifyContent: "center",
      alignItems: "center",
    },
    modalContent: {
      borderRadius: 0,
      padding: 20,
      minWidth: "80%",
      maxHeight: "100%",
      elevation: 5,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      backgroundColor: palette[PaletteColor.Surface],
    },
    emptyStateContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 32,
    },
    emptyStateText: {
      fontSize: 18,
      fontWeight: "600",
      color: palette[PaletteColor.SecondaryText],
      marginBottom: 8,
      textAlign: "center",
    },
    emptyStateSubtext: {
      fontSize: 14,
      color: palette[PaletteColor.SecondaryText],
      textAlign: "center",
    },
  });

export default PatternListManager;
