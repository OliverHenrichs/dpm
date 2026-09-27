import React from "react";
import {
  Platform,
  Pressable,
  PressableProps,
  StyleProp,
  ViewStyle,
} from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { alpha } from "@/src/common/theme/tokens";

export interface TappableProps extends Omit<
  PressableProps,
  "style" | "children" | "accessibilityLabel"
> {
  children: React.ReactNode;
  /** Required: the content is an image or a drawing, with nothing to read out. */
  accessibilityLabel: string;
  /** Ripple past the bounds, for content with no visible edge (a logo). */
  borderless?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * The press behaviour of the other primitives — ripple on Android, a fade
 * elsewhere, a button role — around content they do not cover: a logo, a
 * video thumbnail. Reach for `Button`, `IconButton`, `ListRow` or `Card` first.
 */
const Tappable: React.FC<TappableProps> = ({
  children,
  borderless = false,
  style,
  disabled,
  ...rest
}) => {
  const { theme } = useUnistyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      android_ripple={{
        color: alpha(theme.colors.text, 0.12),
        borderless,
        foreground: !borderless,
      }}
      style={({ pressed }) => [
        style,
        pressed && Platform.OS !== "android" && styles.pressed,
      ]}
      {...rest}
    >
      {children}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  pressed: { opacity: 0.7 },
});

export default Tappable;
