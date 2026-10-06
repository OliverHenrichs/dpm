import React from "react";
import {
  Platform,
  Pressable,
  StyleProp,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { alpha } from "@/src/common/theme/tokens";
import { haptics } from "@/src/common/ui/haptics";

export interface SwitchRowProps {
  title: string;
  /** What switching it on does or costs (a download, sound removed), under the title. */
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * An option that changes what an action will do, set before the action's button: a titled
 * row with a switch, the whole row one target. Not for starting anything; that is a `Button`.
 */
const SwitchRow: React.FC<SwitchRowProps> = ({
  title,
  description,
  value,
  onValueChange,
  disabled = false,
  accessibilityLabel,
  style,
}) => {
  const { theme } = useUnistyles();

  return (
    <Pressable
      onPress={() => {
        haptics.selection();
        onValueChange(!value);
      }}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={description}
      accessibilityState={{ checked: value, disabled }}
      android_ripple={{
        color: alpha(theme.colors.text, 0.1),
        foreground: true,
      }}
      style={({ pressed }) => [
        styles.row,
        pressed && Platform.OS !== "android" && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <View style={styles.text}>
        <Text style={styles.title}>{title}</Text>
        {description ? (
          <Text style={styles.description}>{description}</Text>
        ) : null}
      </View>
      <View style={styles.track(value)}>
        <View style={styles.thumb(value)} />
      </View>
    </Pressable>
  );
};

const TRACK_WIDTH = 40;
const TRACK_HEIGHT = 24;
const THUMB = 18;
const THUMB_INSET = (TRACK_HEIGHT - THUMB) / 2;

const styles = StyleSheet.create((theme) => ({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.space.md,
    minHeight: 44,
    overflow: "hidden",
    paddingVertical: theme.space.sm,
    paddingHorizontal: theme.space.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  text: { flex: 1, gap: theme.space.xxs },
  title: { ...theme.typography.label, color: theme.colors.text },
  description: { ...theme.typography.caption, color: theme.colors.textMuted },
  track: (on: boolean) => ({
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: Math.min(theme.radius.pill, TRACK_HEIGHT / 2),
    backgroundColor: on ? theme.colors.primary : theme.colors.borderStrong,
  }),
  thumb: (on: boolean) => ({
    position: "absolute",
    top: THUMB_INSET,
    left: on ? TRACK_WIDTH - THUMB - THUMB_INSET : THUMB_INSET,
    width: THUMB,
    height: THUMB,
    borderRadius: Math.min(theme.radius.pill, THUMB / 2),
    backgroundColor: on ? theme.colors.onPrimary : theme.colors.background,
  }),
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.4 },
}));

export default SwitchRow;
