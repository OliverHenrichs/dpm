import React from "react";
import { StyleProp, View, ViewStyle } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import type { AppTheme } from "@/src/common/theme/tokens";

interface ModalOverlayProps {
  children: React.ReactNode;
  /** Where the content sits: a dialog in the middle, a panel at the bottom. */
  align?: "center" | "bottom";
  /** Room kept around the content, beyond the system bars. */
  padding?: keyof AppTheme["space"];
  style?: StyleProp<ViewStyle>;
}

/**
 * The scrim every `Modal` draws behind its content, and the frame that keeps
 * that content clear of the system bars.
 *
 * Android draws apps edge to edge, and a `Modal` gets no insets of its own:
 * without this, a dialog's title sat under the clock and the battery. The scrim
 * still covers the whole screen; only the content is inset. The insets come
 * from Unistyles' runtime, so they follow rotation without a re-render.
 */
const ModalOverlay: React.FC<ModalOverlayProps> = ({
  children,
  align = "center",
  padding = "xl",
  style,
}) => <View style={[styles.overlay(align, padding), style]}>{children}</View>;

const styles = StyleSheet.create((theme, rt) => ({
  overlay: (align: "center" | "bottom", padding: keyof AppTheme["space"]) => ({
    flex: 1,
    backgroundColor: theme.colors.overlay,
    justifyContent: align === "center" ? "center" : "flex-end",
    alignItems: align === "center" ? "center" : "stretch",
    paddingTop: rt.insets.top + theme.space[padding],
    // A bottom panel runs to the screen's edge; its own content keeps clear
    // of the gesture bar (see its card's padding).
    paddingBottom:
      align === "center" ? rt.insets.bottom + theme.space[padding] : 0,
    paddingLeft: rt.insets.left + theme.space[padding],
    paddingRight: rt.insets.right + theme.space[padding],
  }),
}));

export default ModalOverlay;
