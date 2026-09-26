import React from "react";
import {
  Platform,
  Pressable,
  StyleProp,
  View,
  ViewProps,
  ViewStyle,
} from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { alpha } from "@/src/common/theme/tokens";

export interface CardProps extends Omit<ViewProps, "style"> {
  children: React.ReactNode;
  /** `outlined` for items in a list, `elevated` for something floating. */
  variant?: "outlined" | "elevated";
  /** Marks the card as the chosen one of a set. */
  selected?: boolean;
  /** Makes the whole card a button. */
  onPress?: () => void;
  onLongPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/** A surface that groups content, optionally pressable as a whole. */
const Card: React.FC<CardProps> = ({
  children,
  variant = "outlined",
  selected = false,
  onPress,
  onLongPress,
  accessibilityLabel,
  style,
  ...rest
}) => {
  const { theme } = useUnistyles();

  if (!onPress && !onLongPress) {
    return (
      <View style={[styles.card(variant, selected), style]} {...rest}>
        {children}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected }}
      android_ripple={{
        color: alpha(theme.colors.text, 0.08),
        foreground: true,
      }}
      style={({ pressed }) => [
        styles.card(variant, selected),
        pressed && Platform.OS !== "android" && styles.pressed,
        style,
      ]}
      {...rest}
    >
      {children}
    </Pressable>
  );
};

const styles = StyleSheet.create((theme) => ({
  card: (variant: "outlined" | "elevated", selected: boolean) => ({
    overflow: "hidden",
    padding: theme.space.md,
    borderRadius: theme.radius.lg,
    backgroundColor: selected
      ? alpha(theme.colors.primary, 0.08)
      : theme.colors.surface,
    borderWidth: variant === "outlined" || selected ? 1 : 0,
    borderColor: selected ? theme.colors.primary : theme.colors.border,
    ...(variant === "elevated" ? theme.elevation.sm : theme.elevation.none),
  }),
  pressed: { opacity: 0.85 },
}));

export default Card;
