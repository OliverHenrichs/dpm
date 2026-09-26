import React, { useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Button, Chip } from "@/src/common/ui";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import { router } from "expo-router";
import AppHeader from "@/src/common/components/AppHeader";
import PageContainer from "@/src/common/components/PageContainer";
import {
  getCommonListContainer,
  commonStyles,
} from "@/src/common/utils/CommonStyles";
import {
  ThemeType,
  useThemeContext,
} from "@/src/common/components/ThemeContext";
import { findLanguage } from "@/src/settings/types/Languages";
import LanguagePickerBottomSheet from "@/src/settings/components/LanguagePickerBottomSheet";
import PatternListExportModal from "@/src/pattern/data/components/PatternListExportModal";
import PatternListImportModal from "@/src/pattern/data/components/PatternListImportModal";
import { useDataTransfer } from "@/src/settings/hooks/useDataTransfer";
import AppDialog from "@/src/common/components/AppDialog";

const SettingsScreen: React.FC = () => {
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language;
  const { theme: themePreference, setTheme } = useThemeContext();
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const selectedLanguage = findLanguage(currentLang);
  const { theme } = useUnistyles();

  const themeOptions = [
    { value: "system", label: t("themeSystem"), icon: "theme-light-dark" },
    { value: "light", label: t("themeLight"), icon: "white-balance-sunny" },
    { value: "dark", label: t("themeDark"), icon: "weather-night" },
  ];

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
    <PageContainer>
      <AppHeader />
      <ScrollView style={styles.scroll}>
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
            <Chip
              key={opt.value}
              label={opt.label}
              icon={opt.icon}
              selected={themePreference === opt.value}
              onPress={() => setTheme(opt.value as ThemeType)}
            />
          ))}
        </View>

        {/* Data Transfer Section */}
        <View style={commonStyles.sectionHeaderRow}>
          <Text style={commonStyles.sectionTitle}>{t("serialization")}</Text>
        </View>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        ) : (
          <View style={[styles.themeRow, styles.indented]}>
            <Button
              title={t("exportPatterns")}
              icon="export-variant"
              variant="outline"
              onPress={handleExportButtonPress}
            />
            <Button
              title={t("importPatterns")}
              icon="import"
              variant="outline"
              onPress={handleImportButtonPress}
            />
          </View>
        )}

        {/* SPIKE (L3): dev-only, not for merge. */}
        {__DEV__ && (
          <Button
            title="Design gallery"
            icon="palette-swatch-outline"
            variant="ghost"
            onPress={() => router.navigate("/gallery")}
            style={styles.galleryLink}
          />
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

const styles = StyleSheet.create((theme) => ({
  scroll: {
    flex: 1,
    ...getCommonListContainer(theme),
  },
  indented: { marginLeft: theme.space.sm },
  galleryLink: { alignSelf: "flex-start", marginTop: theme.space.xl },
  loadingContainer: {
    paddingVertical: theme.space.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  languageRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.space.sm,
    paddingVertical: theme.space.md,
    paddingHorizontal: theme.space.lg,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.space.xxl,
  },
  languageValue: {
    ...theme.typography.button,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  languageEnglishName: {
    ...theme.typography.bodySmall,
    flex: 1,
    color: theme.colors.textMuted,
  },
  languageChevron: {
    fontSize: theme.iconSize.md,
    color: theme.colors.textMuted,
  },
  themeRow: {
    flexDirection: "row",
    gap: theme.space.md,
    marginBottom: theme.space.xxl,
  },
}));

export default SettingsScreen;
