import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { IconButton } from "@/src/common/ui";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import { Icon } from "@/src/common/ui/Icon";
import {
  dismissDragHint,
  isDragHintDismissed,
} from "@/src/pattern/graph/data/GraphHintStorage";

interface GraphDragHintProps {
  /** Only the network view can be rearranged; the timeline is algorithmic. */
  visible: boolean;
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
const GraphDragHint: React.FC<GraphDragHintProps> = ({ visible }) => {
  const { theme } = useUnistyles();
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

  const dismiss = () => {
    setDismissed(true);
    void dismissDragHint();
  };

  return (
    <View style={styles.bar}>
      <Icon name="gesture-tap-hold" size={18} color={theme.colors.primary} />
      <Text style={styles.text}>{t("graphDragHint")}</Text>
      <IconButton
        icon="close"
        size={18}
        onPress={dismiss}
        accessibilityLabel={t("dismissHint")}
      />
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
  bar: {
    flexDirection: "row",
    alignItems: "center",
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

export default GraphDragHint;
