import React, { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTranslation } from "react-i18next";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { PaletteColor } from "@/src/common/utils/ColorPalette";
import {
  dismissDragHint,
  isDragHintDismissed,
} from "@/src/pattern/graph/data/GraphHintStorage";

interface GraphDragHintProps {
  /** Only the network view can be rearranged; the timeline is algorithmic. */
  visible: boolean;
  palette: Record<PaletteColor, string>;
}

/**
 * Tells the user that nodes can be moved.
 *
 * Long-press-then-drag has no affordance — a node looks exactly the same
 * whether or not it can be picked up — so without this the feature is
 * invisible, which is how it was first reported: "how would I move the graph
 * items?". Dismissible, and the dismissal sticks, because it only needs
 * saying once.
 */
const GraphDragHint: React.FC<GraphDragHintProps> = ({ visible, palette }) => {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void isDragHintDismissed().then((value) => {
      if (!cancelled) setDismissed(value);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!visible || dismissed) return null;

  const styles = getStyles(palette);

  const dismiss = () => {
    setDismissed(true);
    void dismissDragHint();
  };

  return (
    <View style={styles.bar}>
      <Icon
        name="gesture-tap-hold"
        size={18}
        color={palette[PaletteColor.Primary]}
      />
      <Text style={styles.text}>{t("graphDragHint")}</Text>
      <TouchableOpacity
        onPress={dismiss}
        style={styles.dismissButton}
        accessibilityRole="button"
        accessibilityLabel={t("dismissHint")}
      >
        <Icon name="close" size={18} color={palette[PaletteColor.Primary]} />
      </TouchableOpacity>
    </View>
  );
};

const getStyles = (palette: Record<PaletteColor, string>) =>
  StyleSheet.create({
    bar: {
      flexDirection: "row",
      alignItems: "center",
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
    dismissButton: {
      padding: 4,
    },
  });

export default GraphDragHint;
