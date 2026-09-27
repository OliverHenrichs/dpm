import React from "react";
import { Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { SegmentedControl } from "@/src/common/ui";
import { alpha } from "@/src/common/theme/tokens";
import { useTranslation } from "react-i18next";
import { ImportAction } from "@/src/pattern/data/hooks/useImportDecisions";

interface ImportActionButtonsProps {
  currentAction: ImportAction;
  hasConflict: boolean;
  onActionChange: (action: ImportAction) => void;
}

export const ImportActionButtons: React.FC<ImportActionButtonsProps> = ({
  currentAction,
  hasConflict,
  onActionChange,
}) => {
  const { t } = useTranslation();
  if (!hasConflict) {
    return (
      <View style={styles.newListBadge}>
        <Text style={styles.newListText}>{t("newList")}</Text>
      </View>
    );
  }
  // A two-option exclusive choice, announced as radio buttons with their
  // checked state: which one is active was once conveyed by colour alone,
  // which a screen reader cannot read out.
  return (
    <SegmentedControl
      kind="choice"
      segments={[
        { value: "skip", label: t("skip") },
        { value: "replace", label: t("replace") },
      ]}
      value={currentAction}
      onChange={onActionChange}
    />
  );
};
const styles = StyleSheet.create((theme) => ({
  newListBadge: {
    backgroundColor: alpha(theme.colors.success, 0.13),
    paddingVertical: theme.space.sm,
    paddingHorizontal: theme.space.md,
    borderRadius: theme.radius.sm,
    alignItems: "center",
  },
  newListText: {
    ...theme.typography.label,
    color: theme.colors.success,
  },
}));
