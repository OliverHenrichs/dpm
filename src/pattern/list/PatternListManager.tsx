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
import { useTranslation } from "react-i18next";
import { usePatternCrud } from "@/src/pattern/list/hooks/usePatternCrud";

const PatternListManager = () => {
  const { t } = useTranslation();
  const { colorScheme } = useThemeContext();
  const palette = getPalette(colorScheme);
  const {
    activeList,
    patterns,
    patternTypes,
    modifiers,
    isReadonly,
    addPattern,
    editPattern,
    deletePattern,
    addModifier,
    editModifier,
    deleteModifier,
  } = usePatternCrud();

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

  // The mutations live in usePatternCrud; what is left here is which modal is
  // open. Each returns whether it was applied, so a rejected edit — a blank
  // name, a read-only list — leaves the form open instead of silently
  // discarding what the user typed.
  // These return the outcome as well as acting on it: EditPatternForm keeps
  // what the user typed when the answer is `false`.
  const handleAddPattern = async (pattern: NewPattern) => {
    const accepted = await addPattern(pattern);
    if (accepted) setIsAddingNew(false);
    return accepted;
  };

  const handleSavePattern = async (pattern: NewPattern | IPattern) => {
    const accepted = await editPattern(pattern);
    if (accepted) setIsEditing(false);
    return accepted;
  };

  const handleDeletePattern = async (id?: number) => {
    if (await deletePattern(id)) {
      if (selectedPattern?.id === id) setSelectedPattern(undefined);
    }
  };

  const handleEditPattern = (pattern: IPattern) => {
    setSelectedPattern(pattern);
    setIsEditing(true);
  };

  const handleAddModifier = async (modifier: NewModifier | IModifier) => {
    if (await addModifier(modifier)) setIsAddingModifier(false);
  };

  const handleSaveModifier = async (modifier: NewModifier | IModifier) => {
    if (await editModifier(modifier)) setIsEditingModifier(false);
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
                  onAccepted={handleAddPattern}
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
                  onAccepted={handleSavePattern}
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
                onAccepted={handleAddModifier}
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
                onAccepted={handleSaveModifier}
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
              onDelete={handleDeletePattern}
              onAdd={() => setIsAddingNew(!isAddingNew)}
              onEdit={handleEditPattern}
              selectedPattern={selectedPattern}
            />
          ) : (
            <ModifierList
              modifiers={modifiers}
              patterns={patterns}
              patternTypes={patternTypes}
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
      boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.25)",
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
