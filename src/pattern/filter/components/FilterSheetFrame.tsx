import React from "react";
import { View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import { Button } from "@/src/common/ui";
import BottomSheet from "@/src/common/components/BottomSheet";
import RevealScrollView from "@/src/common/components/RevealScrollView";

interface FilterSheetFrameProps {
  visible: boolean;
  title: string;
  /** Closes without applying. */
  onClose: () => void;
  onReset: () => void;
  onApply: () => void;
  children: React.ReactNode;
}

/**
 * The sheet around the Modifiers and Sequences filters: the criteria scroll, Reset and Apply
 * stay below, as in the figures' filter (`PatternFilterBottomSheet`).
 */
const FilterSheetFrame: React.FC<FilterSheetFrameProps> = ({
  visible,
  title,
  onClose,
  onReset,
  onApply,
  children,
}) => {
  const { t } = useTranslation();
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={title}
      maxHeight="80%"
    >
      <RevealScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {children}
      </RevealScrollView>
      <View style={styles.buttonRow}>
        <Button
          title={t("reset")}
          variant="secondary"
          onPress={onReset}
          style={styles.footerButton}
        />
        <Button
          title={t("apply")}
          onPress={onApply}
          style={styles.footerButton}
        />
      </View>
    </BottomSheet>
  );
};

const styles = StyleSheet.create((theme) => ({
  scrollView: { flexGrow: 0 },
  scrollContent: { paddingBottom: theme.space.lg },
  buttonRow: {
    flexDirection: "row",
    gap: theme.space.md,
    marginTop: theme.space.lg,
  },
  footerButton: { flex: 1 },
}));

export default FilterSheetFrame;
