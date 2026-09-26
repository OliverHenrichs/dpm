import React from "react";
import { Text, TouchableOpacity } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { useTranslation } from "react-i18next";

interface SelectAllButtonProps {
  allSelected: boolean;
  onToggle: () => void;
}

export const SelectAllButton: React.FC<SelectAllButtonProps> = ({
  allSelected,
  onToggle,
}) => {
  const { t } = useTranslation();
  return (
    <TouchableOpacity style={styles.selectAllButton} onPress={onToggle}>
      <Text style={styles.selectAllText}>
        {allSelected ? t("deselectAll") : t("selectAll")}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create((theme) => ({
  selectAllButton: {
    alignSelf: "flex-end",
    paddingVertical: theme.space.sm,
    paddingHorizontal: theme.space.md,
    marginBottom: theme.space.md,
  },
  selectAllText: {
    ...theme.typography.label,
    color: theme.colors.primary,
  },
}));
