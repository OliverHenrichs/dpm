import React from "react";
import { View, ViewProps } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { SCREEN_EDGE_INSET } from "@/src/common/utils/EdgeInsets";

interface PageContainerProps extends ViewProps {
  children: React.ReactNode;
}

const PageContainer: React.FC<PageContainerProps> = ({
  children,
  style,
  ...rest
}) => (
  <View style={[styles.container, style]} {...rest}>
    {children}
  </View>
);

const styles = StyleSheet.create((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingVertical: theme.space.sm,
    // Wider than the vertical padding on purpose: this is what keeps
    // horizontally scrollable content clear of the system back gesture's
    // band at each screen edge. See `SCREEN_EDGE_INSET`.
    paddingHorizontal: SCREEN_EDGE_INSET,
  },
}));

export default PageContainer;
