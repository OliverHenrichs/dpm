import React, { useState } from "react";
import { Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import { IconButton, Tappable } from "@/src/common/ui";
import { Icon, type IconName } from "@/src/common/ui/Icon";
import PlusButton from "@/src/common/components/PlusButton";
import SortBottomSheet, {
  SortConfig,
  SortOption,
} from "@/src/pattern/list/SortBottomSheet";

interface ListToolbarProps<F extends string> {
  sort: SortConfig<F>;
  /** What the segment can be sorted by, in the sheet's order. */
  sortOptions: SortOption<F>[];
  onSortChange: (sort: SortConfig<F>) => void;
  /** The sort sheet's title, also read out for the sort chip ("Sort Figures"). */
  sortTitle: string;
  /** How many of the filter's criteria are set; 0 shows a plain _Filter_. */
  activeFilters: number;
  onFilter: () => void;
  /** Read out for the filter chip: what is filtered ("Filter Figures"). */
  filterAccessibilityLabel: string;
  /** A read-only list shows a lock in place of list settings and '+'. */
  isReadonly?: boolean;
  /** Opens the list's settings. */
  onEditList?: () => void;
  onAdd: () => void;
  addAccessibilityLabel: string;
  /** Greys out '+' (Sequences at their limit). */
  addDisabled?: boolean;
}

/**
 * The bar above each of the List tab's segments (Figures, Modifiers, Sequences): how the list is
 * shown on the left, as labelled chips (sort by what, filter with how many criteria), and what
 * changes the list on the right: its settings, then '+', or a lock on a read-only list. The
 * segment control above already names the list, so the bar has no title. Followers' actions are
 * not here but in the band above the segments (`ListSharingBand`). The bar owns the sort sheet;
 * each segment owns its filter sheet, since the criteria differ.
 */
function ListToolbar<F extends string>({
  sort,
  sortOptions,
  onSortChange,
  sortTitle,
  activeFilters,
  onFilter,
  filterAccessibilityLabel,
  isReadonly = false,
  onEditList,
  onAdd,
  addAccessibilityLabel,
  addDisabled,
}: ListToolbarProps<F>) {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const [isSortVisible, setIsSortVisible] = useState(false);
  const sortLabel = sortOptions.find((o) => o.field === sort.field)!.label;
  const filtering = activeFilters > 0;
  return (
    <View style={styles.bar}>
      <View style={styles.chips}>
        <ToolbarChip
          icon={sort.order === "asc" ? "sort-ascending" : "sort-descending"}
          label={sortLabel}
          onPress={() => setIsSortVisible(true)}
          accessibilityLabel={sortTitle}
          accessibilityValue={`${sortLabel}, ${t(
            sort.order === "asc" ? "sortAscending" : "sortDescending",
          )}`}
          chevron
        />
        <ToolbarChip
          icon={filtering ? "filter" : "filter-outline"}
          label={
            filtering
              ? t("filterChipActive", { count: activeFilters })
              : t("filterChip")
          }
          onPress={onFilter}
          accessibilityLabel={filterAccessibilityLabel}
          accessibilityValue={filtering ? String(activeFilters) : undefined}
          active={filtering}
        />
      </View>
      <View style={styles.actions}>
        {isReadonly ? (
          <Icon
            name="lock-outline"
            size={theme.iconSize.lg}
            color={theme.colors.textMuted}
            accessibilityLabel={t("readonlyList")}
          />
        ) : (
          <>
            {onEditList && (
              <IconButton
                icon="tune-variant"
                onPress={onEditList}
                accessibilityLabel={t("editTypes")}
              />
            )}
            <PlusButton
              onPress={onAdd}
              accessibilityLabel={addAccessibilityLabel}
              disabled={addDisabled}
            />
          </>
        )}
      </View>
      <SortBottomSheet
        visible={isSortVisible}
        onClose={() => setIsSortVisible(false)}
        onApplySort={onSortChange}
        currentSort={sort}
        options={sortOptions}
        title={sortTitle}
      />
    </View>
  );
}

interface ToolbarChipProps {
  icon: IconName;
  label: string;
  onPress: () => void;
  accessibilityLabel: string;
  /** Read out after the label: the sort in force, or how many filter criteria are set. */
  accessibilityValue?: string;
  /** A filter that is on: outlined and drawn in the success colour, as the filter icon was. */
  active?: boolean;
  /** A small chevron after the label: the chip opens a choice. */
  chevron?: boolean;
}

const ToolbarChip: React.FC<ToolbarChipProps> = ({
  icon,
  label,
  onPress,
  accessibilityLabel,
  accessibilityValue,
  active = false,
  chevron = false,
}) => {
  const { theme } = useUnistyles();
  return (
    <Tappable
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: active }}
      accessibilityValue={
        accessibilityValue ? { text: accessibilityValue } : undefined
      }
      style={[styles.chip, active && styles.chipActive]}
      hitSlop={{ top: 6, bottom: 6 }}
    >
      <Icon
        name={icon}
        size={theme.iconSize.sm}
        color={active ? theme.colors.success : theme.colors.textMuted}
      />
      <Text style={styles.chipLabel} numberOfLines={1}>
        {label}
      </Text>
      {chevron && (
        <Icon
          name="chevron-down"
          size={theme.iconSize.sm}
          color={theme.colors.textMuted}
        />
      )}
    </Tappable>
  );
};

const styles = StyleSheet.create((theme) => ({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.space.sm,
    paddingBottom: theme.space.sm,
    marginBottom: theme.space.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.background,
    minHeight: 44,
  },
  chips: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.space.sm,
    flexShrink: 1,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.space.xs,
    flexShrink: 1,
    paddingVertical: theme.space.xs + theme.space.xxs,
    paddingLeft: theme.space.sm,
    paddingRight: theme.space.md,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  chipActive: {
    borderColor: theme.colors.success,
  },
  chipLabel: {
    ...theme.typography.label,
    color: theme.colors.text,
    flexShrink: 1,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.space.sm,
  },
}));

export default ListToolbar;
