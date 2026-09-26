import React from "react";
import { StyleSheet, TouchableOpacity } from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { PaletteColor } from "@/src/common/utils/ColorPalette";

interface PlusButtonProps {
  onPress: () => void;
  palette: Record<PaletteColor, string>;
  accessibilityLabel?: string;
  disabled?: boolean;
  size?: number;
}

const PlusButton: React.FC<PlusButtonProps> = ({
  onPress,
  palette,
  accessibilityLabel,
  disabled = false,
  size = 28,
}) => {
  const styles = getStyles();

  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.plusButton}
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
    >
      <Icon
        name="plus-circle"
        size={size}
        color={palette[PaletteColor.Success]}
      />
    </TouchableOpacity>
  );
};

const getStyles = () =>
  StyleSheet.create({
    plusButton: {
      padding: 1,
      borderRadius: 16,
    },
  });

export default PlusButton;
