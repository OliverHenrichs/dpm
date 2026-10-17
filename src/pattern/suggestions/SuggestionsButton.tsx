import React from "react";
import { Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { IconButton } from "@/src/common/ui";

interface SuggestionsButtonProps {
  onPress: () => void;
  accessibilityLabel: string;
  /** Suggestions waiting for review; shown on the icon when there are any. */
  count?: number;
}

/** The List tab's suggestion action: suggesting to a subscribed list, or reviewing on one's own. */
const SuggestionsButton: React.FC<SuggestionsButtonProps> = ({
  onPress,
  accessibilityLabel,
  count = 0,
}) => (
  <View>
    <IconButton
      icon={count > 0 ? "lightbulb-on" : "lightbulb-on-outline"}
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
    />
    {count > 0 && (
      <View style={styles.badge} pointerEvents="none">
        <Text style={styles.count}>{count > 99 ? "99+" : count}</Text>
      </View>
    )}
  </View>
);

const styles = StyleSheet.create((theme) => ({
  badge: {
    position: "absolute",
    top: -theme.space.xxs,
    right: -theme.space.xxs,
    minWidth: theme.space.lg,
    paddingHorizontal: theme.space.xxs,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
  },
  count: {
    ...theme.typography.caption,
    color: theme.colors.onPrimary,
    fontWeight: "700",
  },
}));

export default SuggestionsButton;
