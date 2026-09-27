import React from "react";
import { Text, TextProps } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import type { AppTheme, ColorTokens } from "@/src/common/theme/tokens";

export type TextVariant = keyof AppTheme["typography"];

export interface AppTextProps extends TextProps {
  /** Which text style — names the text's job, not its size. */
  variant?: TextVariant;
  /** A colour role. */
  color?: keyof ColorTokens;
}

/**
 * Text in one of the theme's text styles and colour roles. Prefer it to a
 * `Text` with a hand-built style: a type-scale change then reaches it.
 */
const AppText: React.FC<AppTextProps> = ({
  variant = "body",
  color = "text",
  style,
  ...rest
}) => <Text style={[styles.text(variant, color), style]} {...rest} />;

const styles = StyleSheet.create((theme) => ({
  text: (variant: TextVariant, color: keyof ColorTokens) => ({
    ...theme.typography[variant],
    color: theme.colors[color],
  }),
}));

export default AppText;
