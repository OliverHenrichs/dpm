import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Button,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import AppHeader from "@/components/common/AppHeader";
import PageContainer from "@/components/common/PageContainer";
import {
  getCommonListContainer,
  getCommonStyles,
} from "@/components/common/CommonStyles";
import { ThemeType, useThemeContext } from "@/components/common/ThemeContext";
import { getPalette, PaletteColor } from "@/components/common/ColorPalette";
import { LANGUAGES } from "@/components/settings/types/Languages";
import { exportPatternLists } from "@/components/pattern/data/exportPatterns";
import { importPatternLists } from "@/components/pattern/data/ImportPatterns";
import PatternListExportModal from "@/components/pattern/data/PatternListExportModal";
import PatternListImportModal, {
  ImportDecision,
} from "@/components/pattern/data/PatternListImportModal";
import {
  loadAllPatternLists,
  loadPatterns,
  savePatternList,
  savePatterns,
} from "@/components/pattern/data/PatternListStorage";
import { PatternList } from "@/components/pattern/types/PatternList";
import { PatternListWithPatterns } from "@/components/pattern/data/types/IExportData";

const SettingsScreen: React.FC = () => {
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language;
  const { theme, setTheme, colorScheme } = useThemeContext();
  const commonStyles = getCommonStyles(colorScheme);
  const palette = getPalette(colorScheme);
  const [isLoading, setIsLoading] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [patternLists, setPatternLists] = useState<PatternListWithPatterns[]>(
    [],
  );
  const [importedLists, setImportedLists] = useState<PatternListWithPatterns[]>(
    [],
  );

  const themeOptions = [
    { value: "system", label: t("themeSystem") },
    { value: "light", label: t("themeLight") },
    { value: "dark", label: t("themeDark") },
  ];

  const styles = getStyles(palette);

  // Load pattern lists on mount
  const loadPatternLists = useCallback(async () => {
    try {
      const lists = await loadAllPatternLists();
      const listsWithPatterns: PatternListWithPatterns[] = await Promise.all(
        lists.map(async (list: PatternList) => {
          const patterns = await loadPatterns(list.id);
          return { ...list, patterns };
        }),
      );
      setPatternLists(listsWithPatterns);
    } catch (error) {
      Alert.alert(
        t("error"),
        `Failed to load pattern lists: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }, [t]);

  useEffect(() => {
    loadPatternLists();
  }, [loadPatternLists]);

  const handleExportButtonPress = () => {
    if (patternLists.length === 0) {
      Alert.alert(t("error"), t("noPatternListsToExport"));
      return;
    }
    setShowExportModal(true);
  };

  const handleExport = async (selectedLists: PatternList[]) => {
    setShowExportModal(false);
    setIsLoading(true);
    try {
      const result = await exportPatternLists(
        selectedLists as PatternListWithPatterns[],
      );
      Alert.alert(result.success ? t("success") : t("error"), result.message);
    } catch (error) {
      Alert.alert(
        t("error"),
        `Export failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleImportButtonPress = async () => {
    setIsLoading(true);
    try {
      const result = await importPatternLists();
      if (result.success && result.patternLists) {
        setImportedLists(result.patternLists);
        setShowImportModal(true);
      } else {
        Alert.alert(t("error"), result.message);
      }
    } catch (error) {
      Alert.alert(
        t("error"),
        `Import failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = async (decisions: ImportDecision[]) => {
    setShowImportModal(false);
    setIsLoading(true);
    try {
      let importedCount = 0;
      let skippedCount = 0;

      for (const decision of decisions) {
        if (decision.action === "skip") {
          skippedCount++;
          continue;
        }

        // Save the pattern list
        const listToSave = decision.list as PatternListWithPatterns;
        await savePatternList(listToSave);

        // Save all patterns in the list
        await savePatterns(listToSave.id, listToSave.patterns);
        importedCount++;
      }

      await loadPatternLists();

      Alert.alert(
        t("success"),
        `Imported ${importedCount} list(s), skipped ${skippedCount}`,
      );
    } catch (error) {
      Alert.alert(
        t("error"),
        `Import failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PageContainer
      style={{ backgroundColor: palette[PaletteColor.Background] }}
    >
      <AppHeader />
      <ScrollView
        style={{
          flex: 1,
          ...getCommonListContainer(palette),
        }}
      >
        <View style={commonStyles.sectionHeaderRow}>
          <Text style={commonStyles.sectionTitle}>{t("language")}</Text>
        </View>
        <View style={styles.languageRow}>
          {LANGUAGES.map((lang) => (
            <View
              key={lang.code}
              style={[
                styles.langButton,
                currentLang === lang.code && styles.langButtonSelected,
              ]}
            >
              <Text
                style={[
                  styles.langButtonText,
                  currentLang === lang.code && styles.langButtonTextSelected,
                ]}
                onPress={() => i18n.changeLanguage(lang.code)}
              >
                {lang.label}
              </Text>
            </View>
          ))}
        </View>
        <View style={commonStyles.sectionHeaderRow}>
          <Text style={commonStyles.sectionTitle}>{t("theme")}</Text>
        </View>
        <View style={styles.themeRow}>
          {themeOptions.map((opt) => (
            <View
              key={opt.value}
              style={[
                styles.themeButton,
                theme === opt.value && styles.themeButtonSelected,
              ]}
            >
              <Text
                style={[
                  styles.themeButtonText,
                  theme === opt.value && styles.themeButtonTextSelected,
                ]}
                onPress={() => setTheme(opt.value as ThemeType)}
              >
                {opt.label}
              </Text>
            </View>
          ))}
        </View>
        <View style={commonStyles.sectionHeaderRow}>
          <Text style={commonStyles.sectionTitle}>{t("serialization")}</Text>
        </View>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator
              size="large"
              color={palette[PaletteColor.Primary]}
            />
          </View>
        ) : (
          <View style={[styles.themeRow, { marginLeft: 8 }]}>
            <Button
              title={t("exportPatterns")}
              onPress={handleExportButtonPress}
              color={palette[PaletteColor.Primary]}
            />
            <Button
              title={t("importPatterns")}
              onPress={handleImportButtonPress}
              color={palette[PaletteColor.Primary]}
            />
          </View>
        )}
      </ScrollView>

      <PatternListExportModal
        visible={showExportModal}
        patternLists={patternLists}
        onExport={handleExport}
        onCancel={() => setShowExportModal(false)}
      />

      <PatternListImportModal
        visible={showImportModal}
        importedLists={importedLists}
        existingLists={patternLists}
        onImport={handleImport}
        onCancel={() => setShowImportModal(false)}
      />
    </PageContainer>
  );
};

const getStyles = (palette: Record<PaletteColor, string>) =>
  StyleSheet.create({
    loadingContainer: {
      paddingVertical: 20,
      alignItems: "center",
      justifyContent: "center",
    },
    languageRow: {
      flexDirection: "row",
      gap: 12,
      marginBottom: 24,
    },
    langButton: {
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 8,
      backgroundColor: palette[PaletteColor.Surface],
      borderWidth: 1,
      borderColor: palette[PaletteColor.Border],
    },
    langButtonSelected: {
      backgroundColor: palette[PaletteColor.Primary],
      borderColor: palette[PaletteColor.Primary],
    },
    langButtonText: {
      color: palette[PaletteColor.PrimaryText],
      fontWeight: "bold",
    },
    langButtonTextSelected: {
      color: palette[PaletteColor.Surface],
    },
    themeRow: {
      flexDirection: "row",
      gap: 12,
      marginBottom: 24,
    },
    themeButton: {
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 8,
      backgroundColor: palette[PaletteColor.Surface],
      borderWidth: 1,
      borderColor: palette[PaletteColor.Border],
    },
    themeButtonSelected: {
      backgroundColor: palette[PaletteColor.Primary],
      borderColor: palette[PaletteColor.Primary],
    },
    themeButtonText: {
      color: palette[PaletteColor.PrimaryText],
      fontWeight: "bold",
    },
    themeButtonTextSelected: {
      color: palette[PaletteColor.Surface],
    },
  });

export default SettingsScreen;
