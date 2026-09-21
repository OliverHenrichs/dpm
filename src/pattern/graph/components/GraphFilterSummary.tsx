import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTranslation } from "react-i18next";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { PaletteColor } from "@/src/common/utils/ColorPalette";

interface GraphFilterSummaryProps {
  visible: boolean;
  matched: number;
  shown: number;
  total: number;
  onClear: () => void;
  palette: Record<PaletteColor, string>;
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
  palette,
}) => {
  const { t } = useTranslation();
  if (!visible) return null;

  const styles = getStyles(palette);

  return (
    <View style={styles.bar}>
      <Text style={styles.text} numberOfLines={1}>
        {t("graphFilterSummary", { matched, shown, total })}
      </Text>
      <TouchableOpacity
        onPress={onClear}
        style={styles.clearButton}
        accessibilityRole="button"
        accessibilityLabel={t("clearFilter")}
      >
        <Icon
          name="close-circle"
          size={18}
          color={palette[PaletteColor.Primary]}
        />
      </TouchableOpacity>
    </View>
  );
};

const getStyles = (palette: Record<PaletteColor, string>) =>
  StyleSheet.create({
    bar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      paddingVertical: 6,
      paddingHorizontal: 12,
      backgroundColor: palette[PaletteColor.Surface],
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: palette[PaletteColor.Border],
    },
    text: {
      flex: 1,
      fontSize: 12,
      color: palette[PaletteColor.SecondaryText],
    },
    clearButton: {
      padding: 4,
    },
  });

export default GraphFilterSummary;
