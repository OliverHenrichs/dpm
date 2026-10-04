import React, { useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { Button, Chip, ListRow, type IconName } from "@/src/common/ui";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import { router } from "expo-router";
import { Icon } from "@/src/common/ui/Icon";
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
import DeviceModelsSection from "@/src/settings/components/DeviceModelsSection";
import { AppStyle } from "@/src/common/theme/tokens";

const SettingsScreen: React.FC = () => {
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language;
  const {
    theme: themePreference,
    setTheme,
    appStyle,
    setAppStyle,
  } = useThemeContext();
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const selectedLanguage = findLanguage(currentLang);
  const { theme } = useUnistyles();

  const themeOptions: { value: ThemeType; label: string; icon: IconName }[] = [
    { value: "system", label: t("themeSystem"), icon: "theme-light-dark" },
    { value: "light", label: t("themeLight"), icon: "white-balance-sunny" },
    { value: "dark", label: t("themeDark"), icon: "weather-night" },
  ];

  const styleOptions: { value: AppStyle; label: string; hint: string }[] = [
    {
      value: "afterHours",
      label: t("styleAfterHours"),
      hint: t("styleAfterHoursHint"),
    },
    {
      value: "clipboard",
      label: t("styleClipboard"),
      hint: t("styleClipboardHint"),
    },
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
        <ListRow
          variant="card"
          title={selectedLanguage.label}
          meta={
            selectedLanguage.englishName === selectedLanguage.label
              ? undefined
              : selectedLanguage.englishName
          }
          icon="translate"
          trailing={
            <Icon
              name="chevron-right"
              size={theme.iconSize.lg}
              color={theme.colors.textMuted}
            />
          }
          onPress={() => setShowLanguagePicker(true)}
          accessibilityLabel={`${t("language")}: ${selectedLanguage.label}`}
        />

        {/* Style Section */}
        <View style={commonStyles.sectionHeaderRow}>
          <Text style={commonStyles.sectionTitle}>{t("appStyle")}</Text>
        </View>
        <View style={styles.styleList}>
          {styleOptions.map((opt) => (
            <ListRow
              key={opt.value}
              title={opt.label}
              subtitle={opt.hint}
              selection="single"
              selected={appStyle === opt.value}
              onPress={() => setAppStyle(opt.value)}
            />
          ))}
        </View>

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

        <DeviceModelsSection />

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
  styleList: { gap: theme.space.xs, marginBottom: theme.space.xxl },
  galleryLink: { alignSelf: "flex-start", marginTop: theme.space.xl },
  loadingContainer: {
    paddingVertical: theme.space.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  themeRow: {
    flexDirection: "row",
    gap: theme.space.md,
    marginBottom: theme.space.xxl,
  },
}));

export default SettingsScreen;
