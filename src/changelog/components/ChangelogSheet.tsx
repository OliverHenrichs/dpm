import React from "react";
import { ScrollView } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import BottomSheet from "@/src/common/components/BottomSheet";
import ChangelogEntries from "@/src/changelog/components/ChangelogEntries";
import { CHANGELOG } from "@/src/changelog/changelog";

interface ChangelogSheetProps {
  visible: boolean;
  onClose: () => void;
}

/** Every version's changes, opened from Settings. */
const ChangelogSheet: React.FC<ChangelogSheetProps> = ({
  visible,
  onClose,
}) => {
  const { t } = useTranslation();

  return (
    <BottomSheet visible={visible} onClose={onClose} title={t("changelog")}>
      <ScrollView contentContainerStyle={styles.content}>
        <ChangelogEntries entries={CHANGELOG} />
      </ScrollView>
    </BottomSheet>
  );
};

const styles = StyleSheet.create((theme) => ({
  content: { paddingBottom: theme.space.lg },
}));

export default ChangelogSheet;
