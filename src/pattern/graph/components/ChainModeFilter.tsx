import React from "react";
import { Text, View } from "react-native";
import { Chip } from "@/src/common/ui";
import { useTranslation } from "react-i18next";
import { filterStyles as styles } from "@/src/pattern/filter/FilterCommonStyles";
import { ChainMode } from "@/src/pattern/graph/model/selectSubgraph";
import {
  CHAIN_MODE_LABELS,
  OFFERED_CHAIN_MODES,
} from "@/src/pattern/graph/types/ChainMode";

interface ChainModeFilterProps {
  chainMode: ChainMode;
  onChange: (mode: ChainMode) => void;
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
}) => {
  const { t } = useTranslation();

  return (
    <View style={styles.filterSection}>
      <Text style={styles.label}>{t("chainMode")}</Text>
      <View style={styles.chipContainer}>
        {OFFERED_CHAIN_MODES.map((mode) => {
          const selected = chainMode === mode;
          return (
            <Chip
              key={mode}
              label={t(CHAIN_MODE_LABELS[mode])}
              selected={selected}
              onPress={() => onChange(mode)}
            />
          );
        })}
      </View>
    </View>
  );
};

export default ChainModeFilter;
