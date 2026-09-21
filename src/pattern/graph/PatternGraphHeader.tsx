import React from "react";
import { StyleSheet, Text, TouchableOpacity } from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { getPalette, PaletteColor } from "@/src/common/utils/ColorPalette";
import SectionHeader from "@/src/common/components/SectionHeader";
import { useTranslation } from "react-i18next";
import { useThemeContext } from "@/src/common/components/ThemeContext";
import { ViewMode } from "@/src/pattern/graph/types/ViewMode";

interface PatternGraphHeaderProps {
  viewMode: ViewMode;
  onToggleView: () => void;
  hasActiveFilter: boolean;
  onFilter: () => void;
}

const PatternGraphHeader: React.FC<PatternGraphHeaderProps> = ({
  viewMode,
  onToggleView,
  hasActiveFilter,
  onFilter,
}) => {
  const { t } = useTranslation();
  const { colorScheme } = useThemeContext();
  const palette = getPalette(colorScheme);
  const styles = getStyles(palette);

  const rightActions = (
    <>
      {/* Same icon/colour convention as PatternListHeader, so an active
          filter reads the same on both screens. */}
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
      <TouchableOpacity
        style={styles.controlButton}
        onPress={onToggleView}
        accessibilityLabel={t("toggleView")}
      >
        <Icon
          name={viewMode === "timeline" ? "graph" : "timeline"}
          size={15}
          color={palette[PaletteColor.Surface]}
        />
        <Text style={styles.buttonText}>{t("toggleView")}</Text>
      </TouchableOpacity>
    </>
  );

  return (
    <SectionHeader
      title={viewMode === "timeline" ? t("timelineView") : t("graphView")}
      rightActions={rightActions}
    />
  );
};

const getStyles = (palette: Record<PaletteColor, string>) =>
  StyleSheet.create({
    controlButton: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: palette[PaletteColor.Primary],
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      gap: 6,
    },
    iconButton: {
      paddingHorizontal: 4,
      paddingVertical: 2,
    },
    buttonText: {
      color: palette[PaletteColor.Surface],
      fontSize: 12,
      fontWeight: "600",
    },
  });

export default PatternGraphHeader;
