import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { PaletteColor } from "@/src/common/utils/ColorPalette";
interface ConflictBadgeProps {
  palette: Record<PaletteColor, string>;
}
export const ConflictBadge: React.FC<ConflictBadgeProps> = ({ palette }) => {
  const { t } = useTranslation();
  const styles = getStyles(palette);
  return (
    <View style={styles.conflictBadge}>
      <Text style={styles.conflictBadgeText}>{t("existsLabel")}</Text>
    </View>
  );
};
const getStyles = (palette: Record<PaletteColor, string>) =>
  StyleSheet.create({
    conflictBadge: {
      backgroundColor: palette[PaletteColor.Danger] + "20",
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 4,
    },
    conflictBadgeText: {
      fontSize: 11,
      color: palette[PaletteColor.Danger],
      fontWeight: "600",
    },
  });
