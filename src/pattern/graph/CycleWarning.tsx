import React from "react";
import { Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { useTranslation } from "react-i18next";

interface CycleWarningProps {
  /** The strongly connected components the model found. */
  cycles: number[][];
}

/**
 * Tells the user their prerequisites contain a loop.
 *
 * Before the graph model, cycle detection existed only to `console.warn` —
 * which no user has ever read, while the graph they were looking at was
 * quietly laying the looped patterns out on a fallback ring. Now that finding
 * them is O(V + E) and already computed, say so.
 */
const CycleWarning: React.FC<CycleWarningProps> = ({ cycles }) => {
  const { t } = useTranslation();
  if (cycles.length === 0) return null;
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

const styles = StyleSheet.create((theme) => ({
  banner: {
    paddingVertical: theme.space.sm,
    paddingHorizontal: theme.space.md,
    backgroundColor: theme.colors.danger,
  },
  text: {
    ...theme.typography.bodySmall,
    color: theme.colors.onDanger,
    textAlign: "center",
  },
}));

export default CycleWarning;
