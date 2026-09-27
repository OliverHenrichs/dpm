import React from "react";
import { IconButton } from "@/src/common/ui";

interface PlusButtonProps {
  onPress: () => void;
  accessibilityLabel: string;
  disabled?: boolean;
  size?: number;
}

/** The "add" action of a section header: a plus in a circle, in the success colour. */
const PlusButton: React.FC<PlusButtonProps> = ({
  onPress,
  accessibilityLabel,
  disabled = false,
  size = 28,
}) => (
  <IconButton
    icon="plus-circle"
    size={size}
    color="success"
    onPress={onPress}
    accessibilityLabel={accessibilityLabel}
    disabled={disabled}
  />
);

export default PlusButton;
