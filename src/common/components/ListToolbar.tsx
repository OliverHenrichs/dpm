import React from "react";
import { Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import { Tappable } from "@/src/common/ui";
import { Icon, type IconName } from "@/src/common/ui/Icon";

interface ListToolbarProps {
  /** The field the list is sorted by, as shown on the sort chip ("Type"). */
  sortLabel: string;
  sortOrder: "asc" | "desc";
  onSort: () => void;
  /** Read out for the sort chip: what is sorted ("Sort Figures"). */
  sortAccessibilityLabel: string;
  /** How many of the filter's criteria are set; 0 shows a plain _Filter_. */
  activeFilters: number;
  onFilter: () => void;
  /** Read out for the filter chip: what is filtered ("Filter Figures"). */
  filterAccessibilityLabel: string;
  /** What changes the list itself, at the right end: its '+', or the lock of a read-only list. */
  actions?: React.ReactNode;
}

/**
 * The bar above each of the List tab's lists (Figures, Modifiers, Sequences): how the list is
 * shown on the left, as labelled chips (sort by what, filter with how many criteria), and what
 * changes the list on the right. The segmented control above already names the list, so the
 * bar has no title. Followers' actions are not here but in the band above the tabs.
 */
const ListToolbar: React.FC<ListToolbarProps> = ({
  sortLabel,
  sortOrder,
  onSort,
  sortAccessibilityLabel,
  activeFilters,
  onFilter,
  filterAccessibilityLabel,
  actions,
}) => {
  const { t } = useTranslation();
  const filtering = activeFilters > 0;
  return (
    <View style={styles.bar}>
      <View style={styles.chips}>
        <ToolbarChip
          icon={sortOrder === "asc" ? "sort-ascending" : "sort-descending"}
          label={sortLabel}
          onPress={onSort}
          accessibilityLabel={sortAccessibilityLabel}
          accessibilityValue={`${sortLabel}, ${t(
            sortOrder === "asc" ? "sortAscending" : "sortDescending",
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
      {actions && <View style={styles.actions}>{actions}</View>}
    </View>
  );
};

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
