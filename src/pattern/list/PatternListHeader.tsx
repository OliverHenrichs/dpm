import React from "react";
import { TouchableOpacity } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
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
      <TouchableOpacity
        onPress={onSort}
        style={styles.iconButton}
        accessibilityLabel={t("sortPatterns")}
      >
        <Icon
          name="sort"
          size={theme.iconSize.lg}
          color={theme.colors.primary}
        />
      </TouchableOpacity>
      <TouchableOpacity
        onPress={onFilter}
        style={styles.iconButton}
        accessibilityLabel={t("filterPatterns")}
      >
        <Icon
          name={hasActiveFilter ? "filter" : "filter-outline"}
          size={theme.iconSize.lg}
          color={hasActiveFilter ? theme.colors.success : theme.colors.primary}
        />
      </TouchableOpacity>
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

const styles = StyleSheet.create((theme) => ({
  iconButton: {
    paddingHorizontal: theme.space.xs,
    paddingVertical: theme.space.xxs,
  },
}));

export default PatternListHeader;
