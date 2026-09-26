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
import { Icon, type IconName } from "@/src/common/ui/Icon";
import { alpha } from "@/src/common/theme/tokens";
import { haptics } from "@/src/common/ui/haptics";

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress: () => void;
  disabled?: boolean;
  /** A MaterialCommunityIcons name. A selected chip shows a check instead. */
  icon?: IconName;
  /** A colour dot before the label — a pattern type's colour, say. */
  swatch?: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * A selectable pill — filter options, types, levels, one-of-several choices.
 * Selection is carried by colour *and* a check mark, so it does not depend on
 * telling two colours apart.
 */
const Chip: React.FC<ChipProps> = ({
  label,
  selected = false,
  onPress,
  disabled = false,
  icon,
  swatch,
  accessibilityLabel,
  accessibilityHint,
  testID,
  style,
}) => {
  const { theme } = useUnistyles();
  const fg = selected ? theme.colors.onPrimary : theme.colors.onSurfaceVariant;
  const glyph = selected ? "check" : icon;

  return (
    <Pressable
      onPress={() => {
        haptics.selection();
        onPress();
      }}
      disabled={disabled}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ selected, disabled }}
      testID={testID}
      android_ripple={{ color: alpha(fg, 0.2), foreground: true }}
      style={({ pressed }) => [
        styles.chip(selected),
        pressed && Platform.OS !== "android" && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      {swatch ? <View style={styles.swatch(swatch)} /> : null}
      {glyph ? <Icon name={glyph} size={theme.iconSize.sm} color={fg} /> : null}
      <Text style={styles.label(selected)}>{label}</Text>
    </Pressable>
  );
};

const styles = StyleSheet.create((theme) => ({
  chip: (selected: boolean) => ({
    flexDirection: "row",
    alignItems: "center",
    gap: theme.space.xs,
    overflow: "hidden",
    minHeight: 36,
    paddingHorizontal: theme.space.md,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: selected ? theme.colors.primary : theme.colors.border,
    backgroundColor: selected
      ? theme.colors.primary
      : theme.colors.surfaceVariant,
  }),
  label: (selected: boolean) => ({
    ...theme.typography.label,
    fontWeight: selected ? "600" : "400",
    color: selected ? theme.colors.onPrimary : theme.colors.onSurfaceVariant,
  }),
  swatch: (color: string) => ({
    width: 10,
    height: 10,
    borderRadius: theme.radius.pill,
    backgroundColor: color,
    borderWidth: 1,
    borderColor: theme.colors.surface,
  }),
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.4 },
}));

export default Chip;
