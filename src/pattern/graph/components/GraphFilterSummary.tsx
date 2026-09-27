import React from "react";
import { Text, View } from "react-native";
import { IconButton } from "@/src/common/ui";
import { StyleSheet } from "react-native-unistyles";
import { useTranslation } from "react-i18next";

interface GraphFilterSummaryProps {
  visible: boolean;
  matched: number;
  shown: number;
  total: number;
  onClear: () => void;
}

/**
 * What the filter did, in one line.
 *
 * On the graph "matching" and "shown" are different sets — a chain mode pulls
 * in prerequisites that did not match — so without this the user cannot tell
 * a match from the context around it, and a narrowed graph is indistinguishable
 * from a list that lost its patterns.
 */
const GraphFilterSummary: React.FC<GraphFilterSummaryProps> = ({
  visible,
  matched,
  shown,
  total,
  onClear,
}) => {
  const { t } = useTranslation();
  if (!visible) return null;

  return (
    <View style={styles.bar}>
      <Text style={styles.text} numberOfLines={1}>
        {t("graphFilterSummary", { matched, shown, total })}
      </Text>
      <IconButton
        icon="close-circle"
        size={18}
        onPress={onClear}
        accessibilityLabel={t("clearFilter")}
      />
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.space.sm,
    paddingVertical: theme.space.sm,
    paddingHorizontal: theme.space.md,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  text: {
    ...theme.typography.caption,
    flex: 1,
    color: theme.colors.textMuted,
  },
}));

export default GraphFilterSummary;
