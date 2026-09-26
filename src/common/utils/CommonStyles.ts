import { StyleSheet, TextStyle, ViewStyle } from "react-native";
import { getPalette, PaletteColor } from "@/src/common/utils/ColorPalette";

export const getCommonBorder = (
  palette: Record<PaletteColor, string>,
): Pick<ViewStyle, "borderWidth" | "borderRadius" | "borderColor"> => ({
  borderWidth: 1,
  borderRadius: 8,
  borderColor: palette[PaletteColor.Border],
});

export const getCommonButton = (
  palette: Record<PaletteColor, string>,
  bgColor?: string,
): ViewStyle => ({
  padding: 8,
  borderRadius: 8,
  backgroundColor: bgColor || palette[PaletteColor.Primary],
});

const createCommonLabel = (
  palette: Record<PaletteColor, string>,
  defaultColor: PaletteColor,
  color?: string,
): TextStyle => ({
  fontSize: 14,
  fontWeight: "500",
  marginBottom: 4,
  color: color || palette[defaultColor],
});

export const getCommonLabel = (
  palette: Record<PaletteColor, string>,
  color?: string,
): TextStyle => createCommonLabel(palette, PaletteColor.Text, color);

export const getCommon2ndOrderLabel = (
  palette: Record<PaletteColor, string>,
  color?: string,
): TextStyle => createCommonLabel(palette, PaletteColor.TextMuted, color);

export const getCommonRow = (): ViewStyle => ({
  flexDirection: "row",
  alignItems: "center",
});

export const getCommonInput = (
  palette: Record<PaletteColor, string>,
): ViewStyle & TextStyle => ({
  ...getCommonBorder(palette),
  borderColor: palette[PaletteColor.BorderStrong],
  padding: 8,
  color: palette[PaletteColor.Text],
  backgroundColor: palette[PaletteColor.SurfaceVariant],
});

export const getCommonPrereqContainer = (
  palette: Record<PaletteColor, string>,
): ViewStyle => ({
  ...getCommonBorder(palette),
  backgroundColor: palette[PaletteColor.SurfaceVariant],
  padding: 8,
  marginVertical: 8,
});

export const getCommonPrereqItem = (
  palette: Record<PaletteColor, string>,
): ViewStyle => ({
  ...getCommonBorder(palette),
  padding: 6,
  marginRight: 4,
  backgroundColor: palette[PaletteColor.Surface],
});

export const getCommonTagItem = (
  palette: Record<PaletteColor, string>,
): ViewStyle => ({
  flexDirection: "row",
  alignItems: "center",
  backgroundColor: palette[PaletteColor.SurfaceVariant],
  paddingHorizontal: 8,
  marginRight: 4,
  marginBottom: 4,
  ...getCommonBorder(palette),
});

export const getCommonTagText = (
  palette: Record<PaletteColor, string>,
): TextStyle => ({
  color: palette[PaletteColor.OnSurfaceVariant],
  fontSize: 12,
});

export const getCommonListContainer = (
  palette: Record<PaletteColor, string>,
): ViewStyle => ({
  borderRadius: 12,
  padding: 8,
  marginBottom: 8,
  elevation: 2,
  backgroundColor: palette[PaletteColor.Background],
});

export const getCommonAddButtonContainer = (): ViewStyle => ({
  position: "absolute",
  top: 0,
  right: 0,
  zIndex: 10,
});

export const getCommonStyles = (colorScheme: "light" | "dark") => {
  const palette = getPalette(colorScheme);
  return StyleSheet.create({
    sectionTitle: {
      fontSize: 18,
      fontWeight: "bold",
      color: palette[PaletteColor.Text],
    } as TextStyle,
    sectionHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 8,
      minHeight: 39, // Ensures consistent height with + button
    } as ViewStyle,
  });
};
