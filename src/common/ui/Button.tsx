import React from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleProp,
  Text,
  ViewStyle,
} from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { Icon, type IconName } from "@/src/common/ui/Icon";
import { alpha, type AppTheme } from "@/src/common/theme/tokens";
import { haptics } from "@/src/common/ui/haptics";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "danger"
  | "dangerOutline"
  | "dangerGhost"
  | "media";
export type ButtonSize = "sm" | "md";

export interface ButtonProps {
  title: string;
  onPress: () => void;
  /**
   * `primary` is the one main action on a screen or sheet; `secondary` (a
   * neutral outline — Cancel beside a primary) and `outline` (primary-tinted)
   * sit beside it; `ghost` is a quiet text action (Cancel);
   * `danger` deletes or discards; `dangerOutline` leads to a destructive
   * step (it opens the confirmation that then uses `danger`); `dangerGhost` is a quiet
   * text action that throws away something the user can make again (a new video under
   * review) and needs no confirmation; `media` sits
   * over video or the camera, on a scrim that does not follow the theme.
   */
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** A MaterialCommunityIcons name, shown before the title. */
  icon?: IconName;
  disabled?: boolean;
  /**
   * Called on a press while `disabled`, so the button can say why it is greyed out (a hint
   * beside it). The button still looks and announces itself disabled.
   */
  onDisabledPress?: () => void;
  /** Shows a spinner in place of the icon and blocks presses. */
  loading?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
  /** Layout only — flex, margins, alignment. The look comes from `variant`. */
  style?: StyleProp<ViewStyle>;
}

/** Foreground (label and icon) colour for each variant. */
const foreground = (theme: AppTheme, variant: ButtonVariant) =>
  ({
    primary: theme.colors.onPrimary,
    secondary: theme.colors.text,
    outline: theme.colors.primary,
    ghost: theme.colors.primary,
    danger: theme.colors.onDanger,
    dangerOutline: theme.colors.danger,
    dangerGhost: theme.colors.danger,
    media: theme.media.onScrim,
  })[variant];

const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = "primary",
  size = "md",
  icon,
  disabled = false,
  onDisabledPress,
  loading = false,
  accessibilityLabel,
  accessibilityHint,
  testID,
  style,
}) => {
  const { theme } = useUnistyles();
  const fg = foreground(theme, variant);
  const inactive = disabled || loading;
  // A disabled button with an `onDisabledPress` still takes the press, only to explain itself.
  const explainsItself = disabled && !loading && !!onDisabledPress;

  return (
    <Pressable
      onPress={() => {
        if (disabled) {
          onDisabledPress?.();
          return;
        }
        if (variant === "danger") haptics.heavy();
        onPress();
      }}
      // Pressable writes its `disabled` into accessibilityState, so leave it unset here and
      // let the state below announce the button as disabled.
      disabled={explainsItself ? undefined : inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      testID={testID}
      android_ripple={{ color: alpha(fg, 0.24), foreground: true }}
      style={({ pressed }) => [
        styles.button(variant, size),
        pressed && Platform.OS !== "android" && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={fg} />
      ) : icon ? (
        <Icon
          name={icon}
          size={size === "sm" ? theme.iconSize.sm : theme.iconSize.md}
          color={fg}
        />
      ) : null}
      <Text style={styles.label(variant, size)} numberOfLines={1}>
        {title}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create((theme) => ({
  button: (variant: ButtonVariant, size: ButtonSize) => ({
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.space.sm,
    overflow: "hidden",
    borderRadius: theme.radius.md,
    borderWidth: ["outline", "secondary", "dangerOutline"].includes(variant)
      ? 1
      : 0,
    borderColor: {
      primary: theme.colors.primary,
      secondary: theme.colors.border,
      outline: theme.colors.primary,
      ghost: theme.colors.primary,
      danger: theme.colors.danger,
      dangerOutline: theme.colors.danger,
      dangerGhost: theme.colors.danger,
      media: theme.media.scrim,
    }[variant],
    minHeight: size === "sm" ? 36 : theme.touchTarget,
    paddingHorizontal: size === "sm" ? theme.space.md : theme.space.lg,
    backgroundColor: {
      primary: theme.colors.primary,
      secondary: "transparent",
      outline: "transparent",
      ghost: "transparent",
      danger: theme.colors.danger,
      dangerOutline: "transparent",
      dangerGhost: "transparent",
      media: theme.media.scrim,
    }[variant],
  }),
  label: (variant: ButtonVariant, size: ButtonSize) => ({
    ...(size === "sm" ? theme.typography.label : theme.typography.button),
    color: foreground(theme, variant),
  }),
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.45 },
}));

export default Button;
