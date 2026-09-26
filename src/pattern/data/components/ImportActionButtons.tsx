import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
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
  // A two-option exclusive choice, so the buttons carry the radio role and
  // their selected state: which one is active was previously conveyed by
  // colour alone, which a screen reader cannot read out.
  return (
    <View style={styles.actionButtons} accessibilityRole="radiogroup">
      <TouchableOpacity
        accessibilityRole="radio"
        accessibilityLabel={t("skip")}
        accessibilityState={{ selected: currentAction === "skip" }}
        style={[
          styles.actionButton,
          currentAction === "skip" && styles.actionButtonSelected,
        ]}
        onPress={() => onActionChange("skip")}
      >
        <Text
          style={[
            styles.actionButtonText,
            currentAction === "skip" && styles.actionButtonTextSelected,
          ]}
        >
          {t("skip")}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityRole="radio"
        accessibilityLabel={t("replace")}
        accessibilityState={{ selected: currentAction === "replace" }}
        style={[
          styles.actionButton,
          currentAction === "replace" && styles.actionButtonSelected,
        ]}
        onPress={() => onActionChange("replace")}
      >
        <Text
          style={[
            styles.actionButtonText,
            currentAction === "replace" && styles.actionButtonTextSelected,
          ]}
        >
          {t("replace")}
        </Text>
      </TouchableOpacity>
    </View>
  );
};
const styles = StyleSheet.create((theme) => ({
  actionButtons: {
    flexDirection: "row",
    gap: theme.space.sm,
  },
  actionButton: {
    flex: 1,
    paddingVertical: theme.space.sm,
    paddingHorizontal: theme.space.md,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
    alignItems: "center",
  },
  actionButtonSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary,
  },
  actionButtonText: {
    ...theme.typography.label,
    color: theme.colors.text,
  },
  actionButtonTextSelected: {
    color: theme.colors.onPrimary,
  },
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
