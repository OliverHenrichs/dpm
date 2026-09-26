import React from "react";
import { View } from "react-native";
import { ListRow } from "@/src/common/ui";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
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
  const { theme } = useUnistyles();

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
      maxHeight="50%"
    >
      <View style={styles.optionsContainer}>
        {sortOptions.map(({ field, label }) => {
          const isActive = currentSort.field === field;
          const isAsc = isActive && currentSort.order === "asc";

          return (
            <ListRow
              key={field}
              title={label}
              selected={isActive}
              onPress={() => handleSort(field)}
              accessibilityLabel={
                isActive
                  ? `${label}, ${t(isAsc ? "sortAscending" : "sortDescending")}`
                  : label
              }
              trailing={
                isActive ? (
                  <Icon
                    name={isAsc ? "sort-ascending" : "sort-descending"}
                    size={theme.iconSize.lg}
                    color={theme.colors.primary}
                  />
                ) : undefined
              }
            />
          );
        })}
      </View>
    </BottomSheet>
  );
};

const styles = StyleSheet.create((theme) => ({
  optionsContainer: {
    gap: theme.space.sm,
  },
}));

export default SortBottomSheet;
