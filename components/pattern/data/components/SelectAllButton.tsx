import React from "react";
import { StyleSheet, Text, TouchableOpacity } from "react-native";
import { useTranslation } from "react-i18next";
import { PaletteColor } from "@/components/common/ColorPalette";

interface SelectAllButtonProps {
  allSelected: boolean;
  onToggle: () => void;
  palette: Record<PaletteColor, string>;
}

export const SelectAllButton: React.FC<SelectAllButtonProps> = ({
  allSelected,
  onToggle,
  palette,
}) => {
  const { t } = useTranslation();
  const styles = getStyles(palette);
  return (
    <TouchableOpacity style={styles.selectAllButton} onPress={onToggle}>
      <Text style={styles.selectAllText}>
        {allSelected ? t("deselectAll") : t("selectAll")}
      </Text>
    </TouchableOpacity>
  );
};

const getStyles = (palette: Record<PaletteColor, string>) =>
  StyleSheet.create({
    selectAllButton: {
      alignSelf: "flex-end",
      paddingVertical: 8,
      paddingHorizontal: 12,
      marginBottom: 12,
    },
    selectAllText: {
      fontSize: 14,
      fontWeight: "600",
      color: palette[PaletteColor.Primary],
    },
  });
