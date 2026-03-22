import React from "react";
import { StyleSheet, TouchableOpacity } from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { getPalette, PaletteColor } from "@/src/common/utils/ColorPalette";
import PlusButton from "@/src/common/components/PlusButton";
import SectionHeader from "@/src/common/components/SectionHeader";
import { useTranslation } from "react-i18next";
import { useThemeContext } from "@/src/common/components/ThemeContext";

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
  const { colorScheme } = useThemeContext();
  const palette = getPalette(colorScheme);
  const styles = getStyles();

  const rightActions = (
    <>
      <TouchableOpacity
        onPress={onSort}
        style={styles.iconButton}
        accessibilityLabel={t("sortPatterns")}
      >
        <Icon name="sort" size={24} color={palette[PaletteColor.Primary]} />
      </TouchableOpacity>
      <TouchableOpacity
        onPress={onFilter}
        style={styles.iconButton}
        accessibilityLabel={t("filterPatterns")}
      >
        <Icon
          name={hasActiveFilter ? "filter" : "filter-outline"}
          size={24}
          color={
            hasActiveFilter
              ? palette[PaletteColor.Accent]
              : palette[PaletteColor.Primary]
          }
        />
      </TouchableOpacity>
      {isReadonly ? (
        <Icon
          name="lock-outline"
          size={24}
          color={palette[PaletteColor.SecondaryText]}
          accessibilityLabel={t("readonlyList")}
        />
      ) : (
        <PlusButton
          onPress={onAdd}
          palette={palette}
          accessibilityLabel={t("addPattern")}
        />
      )}
    </>
  );

  return <SectionHeader title={t("patternList")} rightActions={rightActions} />;
};

const getStyles = () =>
  StyleSheet.create({
    iconButton: {
      paddingHorizontal: 4,
      paddingVertical: 2,
    },
  });

export default PatternListHeader;
