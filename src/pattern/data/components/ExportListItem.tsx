import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { alpha } from "@/src/common/theme/tokens";
import { useTranslation } from "react-i18next";
import { PatternListWithPatterns } from "@/src/pattern/data/types/IExportData";

interface ExportListItemProps {
  list: PatternListWithPatterns;
  isSelected: boolean;
  onToggle: () => void;
}
export const ExportListItem: React.FC<ExportListItemProps> = ({
  list,
  isSelected,
  onToggle,
}) => {
  const { t } = useTranslation();
  return (
    <TouchableOpacity
      style={[styles.listItem, isSelected && styles.listItemSelected]}
      onPress={onToggle}
    >
      <View style={styles.checkbox}>
        {isSelected && <Text style={styles.checkmark}>✓</Text>}
      </View>
      <View style={styles.listInfo}>
        <Text style={styles.listName}>{list.name}</Text>
        <Text style={styles.listMeta}>
          {list.patterns.length} {t("patterns")}
        </Text>
      </View>
    </TouchableOpacity>
  );
};
const styles = StyleSheet.create((theme) => ({
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: theme.space.md,
    borderRadius: theme.radius.md,
    marginBottom: theme.space.sm,
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
    borderColor: "transparent",
  },
  listItemSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: alpha(theme.colors.primary, 0.08),
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: theme.radius.xs,
    borderWidth: 2,
    borderColor: theme.colors.border,
    marginRight: theme.space.md,
    justifyContent: "center",
    alignItems: "center",
  },
  checkmark: {
    ...theme.typography.label,
    color: theme.colors.primary,
    fontWeight: "bold",
  },
  listInfo: {
    flex: 1,
  },
  listName: {
    ...theme.typography.button,
    color: theme.colors.text,
    marginBottom: theme.space.xs,
  },
  listMeta: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
}));
