import { StyleSheet, TextStyle, ViewStyle } from "react-native";
import { PaletteColor } from "@/src/common/utils/ColorPalette";
import {
  getCommonBorder,
  getCommonInput,
  getCommonLabel,
} from "@/src/common/utils/CommonStyles";

export const getFilterSection = (): ViewStyle => ({
  marginBottom: 20,
});

export const getFilterLabel = (
  palette: Record<PaletteColor, string>,
): TextStyle => ({
  ...getCommonLabel(palette),
  fontSize: 16,
  fontWeight: "600",
  marginBottom: 8,
});

export const getFilterInput = (
  palette: Record<PaletteColor, string>,
): ViewStyle & TextStyle => ({
  ...getCommonInput(palette),
  fontSize: 16,
});

export const getChipContainer = (): ViewStyle => ({
  flexDirection: "row",
  flexWrap: "wrap",
  gap: 8,
});

export const getChip = (palette: Record<PaletteColor, string>): ViewStyle => ({
  ...getCommonBorder(palette),
  backgroundColor: palette[PaletteColor.SurfaceVariant],
  paddingVertical: 8,
  paddingHorizontal: 12,
  borderRadius: 16,
});

export const getChipSelected = (
  palette: Record<PaletteColor, string>,
): ViewStyle => ({
  backgroundColor: palette[PaletteColor.Primary],
  borderColor: palette[PaletteColor.Primary],
});

export const getChipText = (
  palette: Record<PaletteColor, string>,
): TextStyle => ({
  color: palette[PaletteColor.OnSurfaceVariant],
  fontSize: 14,
});

export const getChipTextSelected = (
  palette: Record<PaletteColor, string>,
): TextStyle => ({
  color: palette[PaletteColor.OnPrimary],
  fontWeight: "bold",
});

export const getFilterCommonStyles = (
  palette: Record<PaletteColor, string>,
) => {
  return StyleSheet.create({
    filterSection: getFilterSection(),
    label: getFilterLabel(palette),
    input: getFilterInput(palette),
    chipContainer: getChipContainer(),
    chip: getChip(palette),
    chipSelected: getChipSelected(palette),
    chipText: getChipText(palette),
    chipTextSelected: getChipTextSelected(palette),
  });
};
