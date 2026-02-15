import React, { useState } from "react";
import { Modal, ScrollView, StyleSheet, Text, View } from "react-native";
import { NewPattern, Pattern } from "@/components/pattern/types/PatternList";
import PatternList from "@/components/pattern/list/PatternList";
import EditPatternForm from "@/components/pattern/list/EditPatternForm";
import AppHeader from "@/components/common/AppHeader";
import PageContainer from "@/components/common/PageContainer";
import { useThemeContext } from "@/components/common/ThemeContext";
import { getPalette, PaletteColor } from "@/components/common/ColorPalette";
import { getCommonListContainer } from "@/components/common/CommonStyles";
import { useActivePatternList } from "@/components/pattern/context/ActivePatternListContext";
import { useTranslation } from "react-i18next";

function createNewId(patterns: Pattern[]) {
  // Simple id generation by finding the max existing id and adding 1
  return patterns.length > 0 ? Math.max(...patterns.map((p) => p.id)) + 1 : 1;
}

const PatternListManager = () => {
  const { t } = useTranslation();
  const { colorScheme } = useThemeContext();
  const palette = getPalette(colorScheme);
  const { activeList, patterns, updatePatterns } = useActivePatternList();

  const [selectedPattern, setSelectedPattern] = useState<Pattern | undefined>(
    undefined,
  );
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const styles = getStyles(palette);

  const patternTypes = activeList?.patternTypes || [];

  const addPattern = async (pattern: NewPattern) => {
    if (!pattern.name.trim()) return;

    const newPattern: Pattern = {
      ...pattern,
      id: createNewId(patterns),
    };

    await updatePatterns([...patterns, newPattern]);
    setIsAddingNew(false);
  };

  const editPattern = async (pattern: NewPattern | Pattern) => {
    if (!pattern.name.trim()) return;

    // If it's a NewPattern (no id), this shouldn't happen in edit mode
    if (!("id" in pattern)) {
      console.error("Cannot edit pattern without id");
      return;
    }

    const updatedPatterns = patterns.map((p) =>
      p.id === pattern.id ? (pattern as Pattern) : p,
    );

    await updatePatterns(updatedPatterns);
    setIsEditing(false);
  };

  const deletePattern = async (id?: number) => {
    const updatedPatterns = patterns.filter((p) => p.id !== id);
    await updatePatterns(updatedPatterns);
    if (selectedPattern?.id === id) setSelectedPattern(undefined);
  };

  const handleEditPattern = (pattern: Pattern) => {
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
            onSelect={(p) => setSelectedPattern(p as Pattern | undefined)}
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
