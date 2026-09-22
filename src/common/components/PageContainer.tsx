import React from "react";
import { StyleSheet, View, ViewProps } from "react-native";
import { getPalette, PaletteColor } from "@/src/common/utils/ColorPalette";
import { useThemeContext } from "@/src/common/components/ThemeContext";
import { SCREEN_EDGE_INSET } from "@/src/common/utils/EdgeInsets";

interface PageContainerProps extends ViewProps {
  children: React.ReactNode;
}

const PageContainer: React.FC<PageContainerProps> = ({
  children,
  style,
  ...rest
}) => {
  const { colorScheme } = useThemeContext();
  const palette = getPalette(colorScheme);
  const styles = getStyles(palette);
  return (
    <View style={[styles.container, style]} {...rest}>
      {children}
    </View>
  );
};

const getStyles = (palette: Record<PaletteColor, string>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: palette[PaletteColor.Background],
      paddingVertical: 8,
      // Wider than the vertical padding on purpose: this is what keeps
      // horizontally scrollable content clear of the system back gesture's
      // band at each screen edge. See `SCREEN_EDGE_INSET`.
      paddingHorizontal: SCREEN_EDGE_INSET,
    },
  });

export default PageContainer;
