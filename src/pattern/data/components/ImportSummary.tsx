import React from "react";
import { StyleSheet, Text } from "react-native";
import { useTranslation } from "react-i18next";
import { PaletteColor } from "@/src/common/utils/ColorPalette";

interface ImportSummaryProps {
  totalLists: number;
  totalPatterns: number;
  conflictCount: number;
  palette: Record<PaletteColor, string>;
}

export const ImportSummary: React.FC<ImportSummaryProps> = ({
  totalLists,
  totalPatterns,
  conflictCount,
  palette,
}) => {
  const { t } = useTranslation();
  const styles = getStyles(palette);
  return (
    <Text style={styles.subtitle}>
      {t("foundListsToImport", { count: totalLists })}
      {"\n"}
      {totalPatterns} {t("patterns")} • {conflictCount} {t("conflicts")}
    </Text>
  );
};

const getStyles = (palette: Record<PaletteColor, string>) =>
  StyleSheet.create({
    subtitle: {
      fontSize: 14,
      color: palette[PaletteColor.TextMuted],
      marginBottom: 16,
      lineHeight: 20,
    },
  });
