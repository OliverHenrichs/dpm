import React from "react";
import {
  ActivityIndicator,
  Button,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import AppHeader from "@/src/common/components/AppHeader";
import PageContainer from "@/src/common/components/PageContainer";
import {
  getCommonListContainer,
  getCommonStyles,
} from "@/src/common/utils/CommonStyles";
import {
  ThemeType,
  useThemeContext,
} from "@/src/common/components/ThemeContext";
import { getPalette, PaletteColor } from "@/src/common/utils/ColorPalette";
import { LANGUAGES } from "@/src/settings/types/Languages";
import PatternListExportModal from "@/src/pattern/data/components/PatternListExportModal";
import PatternListImportModal from "@/src/pattern/data/components/PatternListImportModal";
import { useDataTransfer } from "@/src/settings/hooks/useDataTransfer";
import AppDialog from "@/src/common/components/AppDialog";

const SettingsScreen: React.FC = () => {
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language;
  const { theme, setTheme, colorScheme } = useThemeContext();
  const commonStyles = getCommonStyles(colorScheme);
  const palette = getPalette(colorScheme);

  const themeOptions = [
    { value: "system", label: t("themeSystem") },
    { value: "light", label: t("themeLight") },
    { value: "dark", label: t("themeDark") },
  ];

  const styles = getStyles(palette);

  // Data transfer logic extracted to custom hook
  const {
    isLoading,
    showExportModal,
    setShowExportModal,
    showImportModal,
    setShowImportModal,
    patternLists,
    importedLists,
    handleExportButtonPress,
    handleExport,
    handleImportButtonPress,
    handleImport,
    dialog,
    closeDialog,
  } = useDataTransfer();

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
        {/* Language Section */}
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

        {/* Theme Section */}
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

        {/* Data Transfer Section */}
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

      {dialog && (
        <AppDialog
          visible={true}
          title={dialog.title}
          message={dialog.message}
          onClose={closeDialog}
        />
      )}
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
