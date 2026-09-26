import React from "react";
import { IconButton } from "@/src/common/ui";
import { useUnistyles } from "react-native-unistyles";
import { Icon } from "@/src/common/ui/Icon";
import PlusButton from "@/src/common/components/PlusButton";
import SectionHeader from "@/src/common/components/SectionHeader";
import { useTranslation } from "react-i18next";

interface PatternListHeaderProps {
  hasActiveFilter: boolean;
  isReadonly?: boolean;
  onSort: () => void;
  onFilter: () => void;
  onAdd: () => void;
}

const PatternListHeader: React.FC<PatternListHeaderProps> = ({
  hasActiveFilter,
  isReadonly,
  onSort,
  onFilter,
  onAdd,
}) => {
  const { t } = useTranslation();
  const { theme } = useUnistyles();

  const rightActions = (
    <>
      <IconButton
        icon="sort"
        onPress={onSort}
        accessibilityLabel={t("sortPatterns")}
      />
      <IconButton
        icon={hasActiveFilter ? "filter" : "filter-outline"}
        color={hasActiveFilter ? "success" : "primary"}
        selected={hasActiveFilter}
        onPress={onFilter}
        accessibilityLabel={t("filterPatterns")}
      />
      {isReadonly ? (
        <Icon
          name="lock-outline"
          size={theme.iconSize.lg}
          color={theme.colors.textMuted}
          accessibilityLabel={t("readonlyList")}
        />
      ) : (
        <PlusButton onPress={onAdd} accessibilityLabel={t("addPattern")} />
      )}
    </>
  );

  return <SectionHeader title={t("patternList")} rightActions={rightActions} />;
};

export default PatternListHeader;
