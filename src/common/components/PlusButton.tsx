import React from "react";
import { TouchableOpacity } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";

interface PlusButtonProps {
  onPress: () => void;
  accessibilityLabel?: string;
  disabled?: boolean;
  size?: number;
}

const PlusButton: React.FC<PlusButtonProps> = ({
  onPress,
  accessibilityLabel,
  disabled = false,
  size = 28,
}) => {
  const { theme } = useUnistyles();

  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.plusButton}
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
    >
      <Icon name="plus-circle" size={size} color={theme.colors.success} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create((theme) => ({
  plusButton: {
    padding: 1,
    borderRadius: theme.radius.xl,
  },
}));

export default PlusButton;
