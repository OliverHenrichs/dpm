import React from "react";
import { View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import { AppText } from "@/src/common/ui";

/** What either graph view shows with nothing to draw: no patterns, or none the filter lets through. */
const GraphEmptyState: React.FC<{ hasActiveFilter: boolean }> = ({
  hasActiveFilter,
}) => {
  const { t } = useTranslation();
  return (
    <View style={styles.container}>
      <AppText color="textMuted" style={styles.text}>
        {t(hasActiveFilter ? "noPatternsMatchFilter" : "noPatternsToVisualize")}
      </AppText>
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.colors.background,
    padding: theme.space.xxxl,
  },
  text: {
    textAlign: "center",
  },
}));

export default GraphEmptyState;
