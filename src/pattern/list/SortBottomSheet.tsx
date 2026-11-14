import React from "react";
import { View } from "react-native";
import { ListRow } from "@/src/common/ui";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { Icon } from "@/src/common/ui/Icon";
import { useTranslation } from "react-i18next";
import BottomSheet from "@/src/common/components/BottomSheet";
import { IPattern } from "@/src/pattern/types/IPatternList";

export type SortField = keyof Pick<
  IPattern,
  "name" | "typeId" | "level" | "counts" | "id"
>;
export type SortOrder = "asc" | "desc";

/** A sort of one of the List tab's lists: figures by default, or modifiers and sequences. */
export interface SortConfig<F extends string = SortField> {
  field: F;
  order: SortOrder;
}

export interface SortOption<F extends string = SortField> {
  field: F;
  label: string;
}

/** The figures' sort fields, in the sheet's order. */
export function patternSortOptions(
  t: (key: string) => string,
): SortOption<SortField>[] {
  return [
    { field: "name", label: t("name") },
    { field: "typeId", label: t("type") },
    { field: "level", label: t("level") },
    { field: "counts", label: t("counts") },
    { field: "id", label: t("dateCreated") },
  ];
}

interface SortBottomSheetProps<F extends string> {
  visible: boolean;
  onClose: () => void;
  onApplySort: (config: SortConfig<F>) => void;
  currentSort: SortConfig<F>;
  /** What can be sorted by; the figures' fields unless given. */
  options?: SortOption<F>[];
  /** The sheet's title; "Sort Figures" unless given. */
  title?: string;
}

/** Picks a field; picking the active one again flips its direction. */
function SortBottomSheet<F extends string = SortField>({
  visible,
  onClose,
  onApplySort,
  currentSort,
  options,
  title,
}: SortBottomSheetProps<F>) {
  const { t } = useTranslation();
  const { theme } = useUnistyles();

  const sortOptions =
    options ?? (patternSortOptions(t) as unknown as SortOption<F>[]);

  const handleSort = (field: F) => {
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
      title={title ?? t("sortPatterns")}
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
}

const styles = StyleSheet.create((theme) => ({
  optionsContainer: {
    gap: theme.space.sm,
  },
}));

export default SortBottomSheet;
