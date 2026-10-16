import React from "react";
import { Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { IconButton } from "@/src/common/ui";
import { IconName } from "@/src/common/ui/Icon";

interface SuggestionsButtonProps {
  onPress: () => void;
  accessibilityLabel: string;
  /** Suggestions waiting for review; shown on the icon when there are any. */
  count?: number;
  /** The icon without and with a count; a lightbulb unless given (members use people). */
  icon?: IconName;
  activeIcon?: IconName;
}

/**
 * The List tab's suggestion action: suggesting to a subscribed list, or reviewing on one's own.
 * Members-only lists use it too, for the requests to join.
 */
const SuggestionsButton: React.FC<SuggestionsButtonProps> = ({
  onPress,
  accessibilityLabel,
  count = 0,
  icon = "lightbulb-on-outline",
  activeIcon = "lightbulb-on",
}) => (
  <View>
    <IconButton
      icon={count > 0 ? activeIcon : icon}
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
