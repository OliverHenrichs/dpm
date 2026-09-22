import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity } from "react-native";
import { useTranslation } from "react-i18next";
import BottomSheet from "@/src/common/components/BottomSheet";
import { useThemeContext } from "@/src/common/components/ThemeContext";
import { getPalette, PaletteColor } from "@/src/common/utils/ColorPalette";
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
  const { colorScheme } = useThemeContext();
  const palette = getPalette(colorScheme);
  const styles = getStyles(palette);

  const handleSelect = (code: string) => {
    onSelect(code);
    onClose();
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={t("selectLanguage")}
      palette={palette}
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

const getStyles = (palette: Record<PaletteColor, string>) =>
  StyleSheet.create({
    listContent: {
      paddingBottom: 8,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 14,
      paddingHorizontal: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: "transparent",
    },
    rowSelected: {
      backgroundColor: palette[PaletteColor.CardBackground],
      borderColor: palette[PaletteColor.Primary],
    },
    label: {
      fontSize: 16,
      color: palette[PaletteColor.PrimaryText],
    },
    labelSelected: {
      fontWeight: "bold",
      color: palette[PaletteColor.Primary],
    },
    englishName: {
      flex: 1,
      fontSize: 13,
      color: palette[PaletteColor.SecondaryText],
    },
    check: {
      width: 20,
      textAlign: "right",
      fontSize: 16,
      fontWeight: "bold",
      color: palette[PaletteColor.Primary],
    },
  });

export default LanguagePickerBottomSheet;
