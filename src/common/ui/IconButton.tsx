import React from "react";
import {
  Insets,
  Platform,
  Pressable,
  StyleProp,
  ViewStyle,
} from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { alpha, type ColorTokens } from "@/src/common/theme/tokens";

export interface IconButtonProps {
  /** A MaterialCommunityIcons name. */
  icon: string;
  onPress: () => void;
  /** Required: an icon has no text for a screen reader to read. */
  accessibilityLabel: string;
  accessibilityHint?: string;
  /** Icon size in dp. Defaults to the theme's `iconSize.lg`. */
  size?: number;
  /** Colour role of the icon. */
  color?: keyof ColorTokens;
  /** `filled` puts the icon on a primary disc — a floating action. */
  variant?: "plain" | "filled";
  disabled?: boolean;
  selected?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * A tappable icon. The visible glyph stays its natural size; `hitSlop` grows
 * the touch area to the 44dp minimum around it, so dense toolbars keep their
 * layout and still get fingers-sized targets.
 */
const IconButton: React.FC<IconButtonProps> = ({
  icon,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  size,
  color = "primary",
  variant = "plain",
  disabled = false,
  selected,
  testID,
  style,
}) => {
  const { theme } = useUnistyles();
  const iconSize = size ?? theme.iconSize.lg;
  const padding = variant === "filled" ? theme.space.sm : theme.space.xs;
  const box = iconSize + padding * 2;
  const slop = Math.max(0, (theme.touchTarget - box) / 2);
  const hitSlop: Insets = { top: slop, bottom: slop, left: slop, right: slop };
  const fg =
    variant === "filled" ? theme.colors.onPrimary : theme.colors[color];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={hitSlop}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled, selected }}
      testID={testID}
      // A borderless ripple replaces the view's background on Android, which
      // would erase the filled variant's disc; that one ripples inside it.
      android_ripple={
        variant === "filled"
          ? { color: alpha(theme.colors.onPrimary, 0.24), foreground: true }
          : {
              color: alpha(theme.colors.text, 0.16),
              borderless: true,
              radius: box / 2 + slop,
            }
      }
      style={({ pressed }) => [
        styles.button(variant, padding),
        pressed && Platform.OS !== "android" && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Icon name={icon} size={iconSize} color={fg} />
    </Pressable>
  );
};

const styles = StyleSheet.create((theme) => ({
  button: (variant: "plain" | "filled", padding: number) => ({
    padding,
    overflow: "hidden",
    borderRadius: theme.radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor:
      variant === "filled" ? theme.colors.primary : "transparent",
  }),
  pressed: { opacity: 0.6 },
  disabled: { opacity: 0.4 },
}));

export default IconButton;
