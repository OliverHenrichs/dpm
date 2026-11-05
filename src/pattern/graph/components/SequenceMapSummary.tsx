import React from "react";
import { Text, View } from "react-native";
import { IconButton } from "@/src/common/ui";
import { StyleSheet } from "react-native-unistyles";
import { useTranslation } from "react-i18next";

interface SequenceMapSummaryProps {
  /** The shown sequence's name; nothing renders without one. */
  name?: string;
  /** Its figures the Map draws, and all its figure steps' figures. */
  shown: number;
  figures: number;
  onOpen: () => void;
  onClear: () => void;
}

/**
 * The sequence shown on the Map, in one line above it: its name (tapping it opens the
 * sequence), how many of its figures are drawn when a filter hides some, and a clear button.
 * Without it a dimmed graph looks broken, and the filter sheet is the only way back.
 */
const SequenceMapSummary: React.FC<SequenceMapSummaryProps> = ({
  name,
  shown,
  figures,
  onOpen,
  onClear,
}) => {
  const { t } = useTranslation();
  if (name === undefined) return null;

  return (
    <View style={styles.bar} testID="sequence-map-summary">
      <Text
        style={styles.text}
        numberOfLines={1}
        onPress={onOpen}
        accessibilityRole="button"
      >
        {shown < figures
          ? t("sequenceOnMapPartly", { name, shown, figures })
          : t("sequenceOnMap", { name })}
      </Text>
      <IconButton
        icon="close-circle"
        size={18}
        onPress={onClear}
        accessibilityLabel={t("sequenceHideOnMap")}
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
    color: theme.colors.primary,
  },
}));

export default SequenceMapSummary;
