import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
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

const styles = StyleSheet.create((theme) => ({
  optionsContainer: {
    gap: theme.space.sm,
  },
  option: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: theme.space.lg,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  optionActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.surfaceVariant,
  },
  optionText: {
    ...theme.typography.body,
    color: theme.colors.text,
  },
  optionTextActive: {
    fontWeight: "bold",
    color: theme.colors.primary,
  },
  orderIndicator: {
    fontSize: theme.iconSize.md,
    color: theme.colors.primary,
  },
}));

export default SortBottomSheet;
