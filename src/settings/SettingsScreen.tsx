import React, { useState } from "react";
import {
  ActivityIndicator,
  Button,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
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
import { findLanguage } from "@/src/settings/types/Languages";
import LanguagePickerBottomSheet from "@/src/settings/components/LanguagePickerBottomSheet";
import PatternListExportModal from "@/src/pattern/data/components/PatternListExportModal";
import PatternListImportModal from "@/src/pattern/data/components/PatternListImportModal";
import { useDataTransfer } from "@/src/settings/hooks/useDataTransfer";
import AppDialog from "@/src/common/components/AppDialog";

const SettingsScreen: React.FC = () => {
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language;
  const { theme, setTheme, colorScheme } = useThemeContext();
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const selectedLanguage = findLanguage(currentLang);
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
        {/* One row that opens the full list — a button per language stopped
            fitting across a phone once there were more than a few. */}
        <TouchableOpacity
          style={styles.languageRow}
          onPress={() => setShowLanguagePicker(true)}
          accessibilityRole="button"
          accessibilityLabel={`${t("language")}: ${selectedLanguage.label}`}
        >
          <Text style={styles.languageValue}>{selectedLanguage.label}</Text>
          <Text style={styles.languageEnglishName}>
            {selectedLanguage.englishName === selectedLanguage.label
              ? ""
              : selectedLanguage.englishName}
          </Text>
          <Text style={styles.languageChevron}>›</Text>
        </TouchableOpacity>

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

      <LanguagePickerBottomSheet
        visible={showLanguagePicker}
        onClose={() => setShowLanguagePicker(false)}
        currentLanguage={currentLang}
        onSelect={(code) => i18n.changeLanguage(code)}
      />

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
      alignItems: "center",
      gap: 8,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 8,
      backgroundColor: palette[PaletteColor.Surface],
      borderWidth: 1,
      borderColor: palette[PaletteColor.Border],
      marginBottom: 24,
    },
    languageValue: {
      fontSize: 16,
      fontWeight: "bold",
      color: palette[PaletteColor.PrimaryText],
    },
    languageEnglishName: {
      flex: 1,
      fontSize: 13,
      color: palette[PaletteColor.SecondaryText],
    },
    languageChevron: {
      fontSize: 20,
      color: palette[PaletteColor.SecondaryText],
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
