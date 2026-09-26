import React from "react";
import { Button } from "@/src/common/ui";
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
    <Button
      title={allSelected ? t("deselectAll") : t("selectAll")}
      icon={
        allSelected
          ? "checkbox-multiple-blank-outline"
          : "checkbox-multiple-marked-outline"
      }
      variant="ghost"
      size="sm"
      onPress={onToggle}
      style={styles.selectAllButton}
    />
  );
};

const styles = StyleSheet.create((theme) => ({
  selectAllButton: {
    alignSelf: "flex-end",
    marginBottom: theme.space.md,
  },
}));
