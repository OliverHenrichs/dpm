import React from "react";
import { ScrollView } from "react-native";
import { ListRow } from "@/src/common/ui";
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
            // The endonym alone strands a reader who picked a script by
            // mistake, so the English name shows beside it.
            <ListRow
              key={language.code}
              title={language.label}
              meta={gloss}
              selection="single"
              selected={selected}
              onPress={() => handleSelect(language.code)}
              accessibilityLabel={
                gloss ? `${language.label} (${gloss})` : language.label
              }
            />
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
}));

export default LanguagePickerBottomSheet;
