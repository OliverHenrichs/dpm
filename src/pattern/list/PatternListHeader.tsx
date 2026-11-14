import React from "react";
import { useUnistyles } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import { Icon } from "@/src/common/ui/Icon";
import PlusButton from "@/src/common/components/PlusButton";
import ListToolbar from "@/src/common/components/ListToolbar";

interface PatternListHeaderProps {
  /** The sort field's name ("Type") and direction. */
  sortLabel: string;
  sortOrder: "asc" | "desc";
  /** How many of the filter's criteria are set. */
  activeFilters: number;
  isReadonly?: boolean;
  onSort: () => void;
  onFilter: () => void;
  onAdd: () => void;
  /** Opens the list's settings; absent on a read-only list. */
  onEditList?: () => void;
}

/** The Figures toolbar: sort and filter chips, then list settings and '+' (or the lock of a read-only list). */
const PatternListHeader: React.FC<PatternListHeaderProps> = ({
  sortLabel,
  sortOrder,
  activeFilters,
  isReadonly,
  onSort,
  onFilter,
  onAdd,
  onEditList,
}) => {
  const { t } = useTranslation();
  const { theme } = useUnistyles();

  return (
    <ListToolbar
      sortLabel={sortLabel}
      sortOrder={sortOrder}
      onSort={onSort}
      sortAccessibilityLabel={t("sortPatterns")}
      activeFilters={activeFilters}
      onFilter={onFilter}
      filterAccessibilityLabel={t("filterPatterns")}
      onEditList={onEditList}
      actions={
        isReadonly ? (
          <Icon
            name="lock-outline"
            size={theme.iconSize.lg}
            color={theme.colors.textMuted}
            accessibilityLabel={t("readonlyList")}
          />
        ) : (
          <PlusButton onPress={onAdd} accessibilityLabel={t("addPattern")} />
        )
      }
    />
  );
};

export default PatternListHeader;
