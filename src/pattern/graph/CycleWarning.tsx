import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { PaletteColor } from "@/src/common/utils/ColorPalette";

interface CycleWarningProps {
  /** The strongly connected components the model found. */
  cycles: number[][];
  palette: Record<PaletteColor, string>;
}

/**
 * Tells the user their prerequisites contain a loop.
 *
 * Before the graph model, cycle detection existed only to `console.warn` —
 * which no user has ever read, while the graph they were looking at was
 * quietly laying the looped patterns out on a fallback ring. Now that finding
 * them is O(V + E) and already computed, say so.
 */
const CycleWarning: React.FC<CycleWarningProps> = ({ cycles, palette }) => {
  const { t } = useTranslation();
  if (cycles.length === 0) return null;

  const styles = getStyles(palette);
  const affected = cycles.reduce((total, cycle) => total + cycle.length, 0);

  return (
    <View
      style={styles.banner}
      accessible
      accessibilityRole="alert"
      accessibilityLabel={t("prerequisiteCycleWarning", { count: affected })}
    >
      <Text style={styles.text}>
        {t("prerequisiteCycleWarning", { count: affected })}
      </Text>
    </View>
  );
};

const getStyles = (palette: Record<PaletteColor, string>) =>
  StyleSheet.create({
    banner: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      backgroundColor: palette[PaletteColor.Error],
    },
    text: {
      color: "#FFFFFF",
      fontSize: 13,
      textAlign: "center",
    },
  });

export default CycleWarning;
