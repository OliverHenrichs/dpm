import React from "react";
import { ScrollView, Text, TouchableOpacity } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import BottomSheet from "@/src/common/components/BottomSheet";
import { LANGUAGES } from "@/src/settings/types/Languages";

interface LanguagePickerBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  currentLanguage: string;
  onSelect: (code: string) => void;
}

/**
 * The language list as a sheet rather than a row of buttons: a row per
 * language scales past the handful that fit across a phone, and each row
 * carries the English name so the list stays navigable in a script the
 * reader does not know.
 */
const LanguagePickerBottomSheet: React.FC<LanguagePickerBottomSheetProps> = ({
  visible,
  onClose,
  currentLanguage,
  onSelect,
}) => {
  const { t } = useTranslation();

  const handleSelect = (code: string) => {
    onSelect(code);
    onClose();
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={t("selectLanguage")}
    >
      <ScrollView contentContainerStyle={styles.listContent}>
        {LANGUAGES.map((language) => {
          const selected = language.code === currentLanguage;
          // "English English" helps nobody; the gloss only earns its place
          // when it says something the endonym does not.
          const gloss =
            language.englishName === language.label ? "" : language.englishName;
          return (
            <TouchableOpacity
              key={language.code}
              style={[styles.row, selected && styles.rowSelected]}
              onPress={() => handleSelect(language.code)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={
                gloss ? `${language.label} (${gloss})` : language.label
              }
            >
              <Text style={[styles.label, selected && styles.labelSelected]}>
                {language.label}
              </Text>
              {/* The endonym alone strands a reader who picked a script by
                  mistake, so the English name shows beside it. */}
              <Text style={styles.englishName}>{gloss}</Text>
              <Text style={styles.check}>{selected ? "✓" : ""}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </BottomSheet>
  );
};

const styles = StyleSheet.create((theme) => ({
  listContent: {
    paddingBottom: theme.space.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.space.sm,
    paddingVertical: theme.space.lg,
    paddingHorizontal: theme.space.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: "transparent",
  },
  rowSelected: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.primary,
  },
  label: {
    ...theme.typography.body,
    color: theme.colors.text,
  },
  labelSelected: {
    fontWeight: "bold",
    color: theme.colors.primary,
  },
  englishName: {
    ...theme.typography.bodySmall,
    flex: 1,
    color: theme.colors.textMuted,
  },
  check: {
    ...theme.typography.button,
    width: 20,
    textAlign: "right",
    fontWeight: "bold",
    color: theme.colors.primary,
  },
}));

export default LanguagePickerBottomSheet;
