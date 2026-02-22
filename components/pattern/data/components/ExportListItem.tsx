import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTranslation } from "react-i18next";
import { PatternListWithPatterns } from "@/components/pattern/data/types/IExportData";
import { PaletteColor } from "@/components/common/ColorPalette";

interface ExportListItemProps {
  list: PatternListWithPatterns;
  isSelected: boolean;
  onToggle: () => void;
  palette: Record<PaletteColor, string>;
}
export const ExportListItem: React.FC<ExportListItemProps> = ({
  list,
  isSelected,
  onToggle,
  palette,
}) => {
  const { t } = useTranslation();
  const styles = getStyles(palette);
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
          {list.patterns.length} {t("patterns")} • {list.danceStyle}
        </Text>
      </View>
    </TouchableOpacity>
  );
};
const getStyles = (palette: Record<PaletteColor, string>) =>
  StyleSheet.create({
    listItem: {
      flexDirection: "row",
      alignItems: "center",
      padding: 12,
      borderRadius: 8,
      marginBottom: 8,
      backgroundColor: palette[PaletteColor.CardBackground],
      borderWidth: 2,
      borderColor: "transparent",
    },
    listItemSelected: {
      borderColor: palette[PaletteColor.Primary],
      backgroundColor: palette[PaletteColor.Primary] + "15",
    },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: 4,
      borderWidth: 2,
      borderColor: palette[PaletteColor.Border],
      marginRight: 12,
      justifyContent: "center",
      alignItems: "center",
    },
    checkmark: {
      color: palette[PaletteColor.Primary],
      fontSize: 14,
      fontWeight: "bold",
    },
    listInfo: {
      flex: 1,
    },
    listName: {
      fontSize: 16,
      fontWeight: "600",
      color: palette[PaletteColor.PrimaryText],
      marginBottom: 4,
    },
    listMeta: {
      fontSize: 12,
      color: palette[PaletteColor.SecondaryText],
    },
  });
