import React, { useState } from "react";
import { View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import { Button } from "@/src/common/ui";
import BottomSheet from "@/src/common/components/BottomSheet";
import RevealScrollView from "@/src/common/components/RevealScrollView";

interface FilterSheetFrameProps<F> {
  visible: boolean;
  title: string;
  /** The filter in force: what the sheet opens on. */
  currentFilter: F;
  /** What Reset applies. */
  emptyFilter: F;
  onApplyFilter: (filter: F) => void;
  onClose: () => void;
  /** The criteria, editing a draft that only Apply (or Reset) puts in force. */
  children: (draft: F, setDraft: (filter: F) => void) => React.ReactNode;
}

/**
 * The sheet around the Modifiers and Sequences filters: the criteria scroll, Reset and Apply
 * stay below, as in the figures' filter (`PatternFilterBottomSheet`). It keeps the draft:
 * closing without Apply drops it, so the next opening shows what is in force.
 */
function FilterSheetFrame<F>({
  visible,
  title,
  currentFilter,
  emptyFilter,
  onApplyFilter,
  onClose,
  children,
}: FilterSheetFrameProps<F>) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(currentFilter);
  const onReset = () => {
    setDraft(emptyFilter);
    onApplyFilter(emptyFilter);
  };
  const onApply = () => {
    onApplyFilter(draft);
    onClose();
  };
  return (
    <BottomSheet
      visible={visible}
      onClose={() => {
        setDraft(currentFilter);
        onClose();
      }}
      title={title}
      maxHeight="80%"
    >
      <RevealScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {children(draft, setDraft)}
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
}

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
