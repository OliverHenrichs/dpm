import React from "react";
import { Text } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { useTranslation } from "react-i18next";

interface ImportSummaryProps {
  totalLists: number;
  totalPatterns: number;
  conflictCount: number;
}

export const ImportSummary: React.FC<ImportSummaryProps> = ({
  totalLists,
  totalPatterns,
  conflictCount,
}) => {
  const { t } = useTranslation();
  return (
    <Text style={styles.subtitle}>
      {t("foundListsToImport", { count: totalLists })}
      {"\n"}
      {totalPatterns} {t("patterns")} • {conflictCount} {t("conflicts")}
    </Text>
  );
};

const styles = StyleSheet.create((theme) => ({
  subtitle: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
    marginBottom: theme.space.lg,
    lineHeight: 20,
  },
}));
