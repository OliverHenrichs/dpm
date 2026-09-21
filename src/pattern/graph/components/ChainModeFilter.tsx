import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { useTranslation } from "react-i18next";
import { PaletteColor } from "@/src/common/utils/ColorPalette";
import { getFilterCommonStyles } from "@/src/pattern/filter/FilterCommonStyles";
import { ChainMode } from "@/src/pattern/graph/model/selectSubgraph";
import {
  CHAIN_MODE_LABELS,
  OFFERED_CHAIN_MODES,
} from "@/src/pattern/graph/types/ChainMode";

interface ChainModeFilterProps {
  chainMode: ChainMode;
  onChange: (mode: ChainMode) => void;
  palette: Record<PaletteColor, string>;
}

/**
 * How much of a match's chain to draw alongside it.
 *
 * Sits at the top of the filter sheet because it frames what the criteria
 * below will do: on the graph, "matching" and "shown" are not the same set.
 */
const ChainModeFilter: React.FC<ChainModeFilterProps> = ({
  chainMode,
  onChange,
  palette,
}) => {
  const { t } = useTranslation();
  const styles = getFilterCommonStyles(palette);

  return (
    <View style={styles.filterSection}>
      <Text style={styles.label}>{t("chainMode")}</Text>
      <View style={styles.chipContainer}>
        {OFFERED_CHAIN_MODES.map((mode) => {
          const selected = chainMode === mode;
          return (
            <TouchableOpacity
              key={mode}
              style={[styles.chip, selected && styles.chipSelected]}
              onPress={() => onChange(mode)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={t(CHAIN_MODE_LABELS[mode])}
            >
              <Text
                style={[styles.chipText, selected && styles.chipTextSelected]}
              >
                {t(CHAIN_MODE_LABELS[mode])}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

export default ChainModeFilter;
