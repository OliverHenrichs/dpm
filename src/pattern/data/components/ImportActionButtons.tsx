import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTranslation } from "react-i18next";
import { PaletteColor } from "@/src/common/utils/ColorPalette";
import { ImportAction } from "@/src/pattern/data/hooks/useImportDecisions";

interface ImportActionButtonsProps {
  currentAction: ImportAction;
  hasConflict: boolean;
  onActionChange: (action: ImportAction) => void;
  palette: Record<PaletteColor, string>;
}

export const ImportActionButtons: React.FC<ImportActionButtonsProps> = ({
  currentAction,
  hasConflict,
  onActionChange,
  palette,
}) => {
  const { t } = useTranslation();
  const styles = getStyles(palette);
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
const getStyles = (palette: Record<PaletteColor, string>) =>
  StyleSheet.create({
    actionButtons: {
      flexDirection: "row",
      gap: 8,
    },
    actionButton: {
      flex: 1,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: palette[PaletteColor.Border],
      backgroundColor: palette[PaletteColor.Background],
      alignItems: "center",
    },
    actionButtonSelected: {
      borderColor: palette[PaletteColor.Primary],
      backgroundColor: palette[PaletteColor.Primary],
    },
    actionButtonText: {
      fontSize: 14,
      fontWeight: "600",
      color: palette[PaletteColor.PrimaryText],
    },
    actionButtonTextSelected: {
      color: palette[PaletteColor.Surface],
    },
    newListBadge: {
      backgroundColor: palette[PaletteColor.Accent] + "20",
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 6,
      alignItems: "center",
    },
    newListText: {
      fontSize: 14,
      color: palette[PaletteColor.Accent],
      fontWeight: "600",
    },
  });
