import React, { useState } from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  IModifier,
  IPattern,
  NewModifier,
  NewPattern,
} from "@/src/pattern/types/IPatternList";
import PatternList from "@/src/pattern/list/PatternList";
import EditPatternForm from "@/src/pattern/list/EditPatternForm";
import ModifierList from "@/src/pattern/list/ModifierList";
import EditModifierForm from "@/src/pattern/list/EditModifierForm";
import AppHeader from "@/src/common/components/AppHeader";
import PageContainer from "@/src/common/components/PageContainer";
import { useThemeContext } from "@/src/common/components/ThemeContext";
import { getPalette, PaletteColor } from "@/src/common/utils/ColorPalette";
import { getCommonListContainer } from "@/src/common/utils/CommonStyles";
import { useActivePatternList } from "@/src/pattern/data/components/ActivePatternListContext";
import { useTranslation } from "react-i18next";
import { syncPublishedList } from "@/src/firebase/FirebaseListService";
import { generateUUID } from "@/src/pattern/types/PatternType";

function createNewId(patterns: IPattern[]) {
  // Simple id generation by finding the max existing id and adding 1
  return patterns.length > 0 ? Math.max(...patterns.map((p) => p.id)) + 1 : 1;
}

const PatternListManager = () => {
  const { t } = useTranslation();
  const { colorScheme } = useThemeContext();
  const palette = getPalette(colorScheme);
  const { activeList, patterns, updatePatterns, updateActiveList } =
    useActivePatternList();

  const [selectedPattern, setSelectedPattern] = useState<IPattern | undefined>(
    undefined,
  );
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<"patterns" | "modifiers">(
    "patterns",
  );
  const [isAddingModifier, setIsAddingModifier] = useState(false);
  const [isEditingModifier, setIsEditingModifier] = useState(false);
  const [selectedModifier, setSelectedModifier] = useState<
    IModifier | undefined
  >(undefined);
  const styles = getStyles(palette);

  const patternTypes = activeList?.patternTypes || [];
  const modifiers = activeList?.modifiers || [];
  const isReadonly = !!activeList?.readonly;

  const addPattern = async (pattern: NewPattern) => {
    if (isReadonly || !pattern.name.trim()) return;
    const newPattern: IPattern = { ...pattern, id: createNewId(patterns) };
    const updated = [...patterns, newPattern];
    await updatePatterns(updated);
    if (activeList?.shareCode) {
      syncPublishedList(activeList, updated).catch(() => {});
    }
    setIsAddingNew(false);
  };

  const editPattern = async (pattern: NewPattern | IPattern) => {
    if (isReadonly || !pattern.name.trim()) return;
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

  const addModifier = async (modifier: NewModifier | IModifier) => {
    if (!activeList || isReadonly) return;
    const newModifier: IModifier = { ...modifier, id: generateUUID() };
    const updatedList = {
      ...activeList,
      modifiers: [...modifiers, newModifier],
    };
    await updateActiveList(updatedList);
    setIsAddingModifier(false);
  };

  const editModifier = async (modifier: NewModifier | IModifier) => {
    if (!activeList || isReadonly || !("id" in modifier)) return;
    const updatedList = {
      ...activeList,
      modifiers: modifiers.map((m) =>
        m.id === modifier.id ? (modifier as IModifier) : m,
      ),
    };
    await updateActiveList(updatedList);
    setIsEditingModifier(false);
  };

  const deleteModifier = async (modifierId: string) => {
    if (!activeList || isReadonly) return;
    const updatedModifiers = modifiers.filter((m) => m.id !== modifierId);
    const updatedList = { ...activeList, modifiers: updatedModifiers };
    // Scrub modifier refs from all patterns
    const updatedPatterns = patterns.map((p) => ({
      ...p,
      modifierRefs: (p.modifierRefs ?? []).filter(
        (ref) => ref.modifierId !== modifierId,
      ),
    }));
    await updateActiveList(updatedList, updatedPatterns);
    await updatePatterns(updatedPatterns);
  };

  const handleEditModifier = (modifier: IModifier) => {
    setSelectedModifier(modifier);
    setIsEditingModifier(true);
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

        {/* Add / Edit Pattern modals */}
        <Modal
          visible={isAddingNew}
          animationType="slide"
          transparent
          onRequestClose={() => setIsAddingNew(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
                <EditPatternForm
                  patterns={patterns}
                  patternTypes={patternTypes}
                  modifiers={modifiers}
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
          transparent
          onRequestClose={() => setIsEditing(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
                <EditPatternForm
                  patterns={patterns}
                  patternTypes={patternTypes}
                  modifiers={modifiers}
                  onAccepted={editPattern}
                  onCancel={() => setIsEditing(false)}
                  existing={selectedPattern}
                />
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Add / Edit Modifier modals */}
        <Modal
          visible={isAddingModifier}
          animationType="slide"
          transparent
          onRequestClose={() => setIsAddingModifier(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <EditModifierForm
                onAccepted={addModifier}
                onCancel={() => setIsAddingModifier(false)}
              />
            </View>
          </View>
        </Modal>
        <Modal
          visible={isEditingModifier && selectedModifier != null}
          animationType="slide"
          transparent
          onRequestClose={() => setIsEditingModifier(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <EditModifierForm
                existing={selectedModifier}
                onAccepted={editModifier}
                onCancel={() => setIsEditingModifier(false)}
              />
            </View>
          </View>
        </Modal>

        {/* Tab strip */}
        <View style={styles.tabStrip}>
          <TouchableOpacity
            style={[styles.tab, activeTab === "patterns" && styles.tabActive]}
            onPress={() => setActiveTab("patterns")}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "patterns" && styles.tabTextActive,
              ]}
            >
              {t("patternList")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === "modifiers" && styles.tabActive]}
            onPress={() => setActiveTab("modifiers")}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "modifiers" && styles.tabTextActive,
              ]}
            >
              {t("modifiersTab")}
              {modifiers.length > 0 && (
                <Text style={styles.tabBadge}> ({modifiers.length})</Text>
              )}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.contentContainer}>
          {activeTab === "patterns" ? (
            <PatternList
              patterns={patterns}
              patternTypes={patternTypes}
              modifiers={modifiers}
              isReadonly={isReadonly}
              onSelect={(p) => setSelectedPattern(p as IPattern | undefined)}
              onDelete={deletePattern}
              onAdd={() => setIsAddingNew(!isAddingNew)}
              onEdit={handleEditPattern}
              selectedPattern={selectedPattern}
            />
          ) : (
            <ModifierList
              modifiers={modifiers}
              isReadonly={isReadonly}
              onAdd={() => setIsAddingModifier(true)}
              onEdit={handleEditModifier}
              onDelete={deleteModifier}
            />
          )}
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
    container: { flex: 1 },
    tabStrip: {
      flexDirection: "row",
      marginHorizontal: 8,
      marginBottom: 4,
      borderRadius: 8,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: palette[PaletteColor.Border],
    },
    tab: {
      flex: 1,
      paddingVertical: 8,
      alignItems: "center",
      backgroundColor: palette[PaletteColor.Surface],
    },
    tabActive: {
      backgroundColor: palette[PaletteColor.Primary],
    },
    tabText: {
      fontSize: 14,
      fontWeight: "500",
      color: palette[PaletteColor.SecondaryText],
    },
    tabTextActive: {
      color: palette[PaletteColor.Surface],
      fontWeight: "700",
    },
    tabBadge: {
      fontSize: 12,
      fontWeight: "400",
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
