import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useThemeContext } from "@/src/common/components/ThemeContext";
import { getPalette, PaletteColor } from "@/src/common/utils/ColorPalette";
import { useTranslation } from "react-i18next";
import BottomSheet from "@/src/common/components/BottomSheet";
import { IPattern } from "@/src/pattern/types/IPatternList";

export type SortField = keyof Pick<
  IPattern,
  "name" | "typeId" | "level" | "counts" | "id"
>;
export type SortOrder = "asc" | "desc";

export interface SortConfig {
  field: SortField;
  order: SortOrder;
}

interface SortBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  onApplySort: (config: SortConfig) => void;
  currentSort: SortConfig;
}

const SortBottomSheet: React.FC<SortBottomSheetProps> = ({
  visible,
  onClose,
  onApplySort,
  currentSort,
}) => {
  const { t } = useTranslation();
  const { colorScheme } = useThemeContext();
  const palette = getPalette(colorScheme);
  const styles = getStyles(palette);

  const sortOptions: { field: SortField; label: string }[] = [
    { field: "name", label: t("name") },
    { field: "typeId", label: t("type") },
    { field: "level", label: t("level") },
    { field: "counts", label: t("counts") },
    { field: "id", label: t("dateCreated") },
  ];

  const handleSort = (field: SortField) => {
    const order: SortOrder =
      currentSort.field === field && currentSort.order === "asc"
        ? "desc"
        : "asc";
    onApplySort({ field, order });
    onClose();
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={t("sortPatterns")}
      palette={palette}
      maxHeight="50%"
    >
      <View style={styles.optionsContainer}>
        {sortOptions.map(({ field, label }) => {
          const isActive = currentSort.field === field;
          const isAsc = isActive && currentSort.order === "asc";

          return (
            <TouchableOpacity
              key={field}
              style={[styles.option, isActive && styles.optionActive]}
              onPress={() => handleSort(field)}
            >
              <Text
                style={[styles.optionText, isActive && styles.optionTextActive]}
              >
                {label}
              </Text>
              {isActive && (
                <Text style={styles.orderIndicator}>{isAsc ? "↑" : "↓"}</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </BottomSheet>
  );
};

const getStyles = (palette: Record<PaletteColor, string>) =>
  StyleSheet.create({
    optionsContainer: {
      gap: 8,
    },
    option: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: 16,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: palette[PaletteColor.Border],
      backgroundColor: palette[PaletteColor.Surface],
    },
    optionActive: {
      borderColor: palette[PaletteColor.Primary],
      backgroundColor: palette[PaletteColor.TagBg],
    },
    optionText: {
      fontSize: 16,
      color: palette[PaletteColor.PrimaryText],
    },
    optionTextActive: {
      fontWeight: "bold",
      color: palette[PaletteColor.Primary],
    },
    orderIndicator: {
      fontSize: 20,
      color: palette[PaletteColor.Primary],
    },
  });

export default SortBottomSheet;
