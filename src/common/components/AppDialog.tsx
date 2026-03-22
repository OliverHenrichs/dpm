import React from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { getPalette, PaletteColor } from "@/src/common/utils/ColorPalette";
import { useThemeContext } from "@/src/common/components/ThemeContext";

interface AppDialogProps {
  visible: boolean;
  title: string;
  message: string;
  /** Label for the dismiss / cancel button. Defaults to "OK". */
  closeLabel?: string;
  onClose: () => void;
  /** When provided a second button is shown for the primary action. */
  confirmLabel?: string;
  /** Style the confirm button as destructive (red). */
  confirmDestructive?: boolean;
  onConfirm?: () => void;
}

/**
 * Themed in-app replacement for React Native's Alert.alert.
 *
 * - One button (info / error / success): omit confirmLabel / onConfirm.
 * - Two buttons (confirmation): provide confirmLabel + onConfirm.
 *   Set confirmDestructive for delete-style actions.
 */
const AppDialog: React.FC<AppDialogProps> = ({
  visible,
  title,
  message,
  closeLabel = "OK",
  onClose,
  confirmLabel,
  confirmDestructive = false,
  onConfirm,
}) => {
  const { colorScheme } = useThemeContext();
  const palette = getPalette(colorScheme);
  const styles = getStyles(palette);
  const hasConfirm = !!confirmLabel && !!onConfirm;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={[styles.buttonRow, hasConfirm && styles.buttonRowTwo]}>
            <TouchableOpacity
              style={[styles.button, styles.closeButton]}
              onPress={onClose}
            >
              <Text style={styles.closeButtonText}>{closeLabel}</Text>
            </TouchableOpacity>
            {hasConfirm && (
              <TouchableOpacity
                style={[
                  styles.button,
                  confirmDestructive
                    ? styles.destructiveButton
                    : styles.primaryButton,
                ]}
                onPress={onConfirm}
              >
                <Text
                  style={
                    confirmDestructive
                      ? styles.destructiveButtonText
                      : styles.primaryButtonText
                  }
                >
                  {confirmLabel}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const getStyles = (palette: Record<PaletteColor, string>) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "center",
      alignItems: "center",
      padding: 32,
    },
    card: {
      backgroundColor: palette[PaletteColor.Surface],
      borderRadius: 16,
      padding: 24,
      width: "100%",
      maxWidth: 380,
    },
    title: {
      fontSize: 18,
      fontWeight: "bold",
      color: palette[PaletteColor.PrimaryText],
      marginBottom: 10,
    },
    message: {
      fontSize: 15,
      color: palette[PaletteColor.SecondaryText],
      lineHeight: 22,
      marginBottom: 24,
    },
    buttonRow: {
      flexDirection: "row",
      justifyContent: "flex-end",
    },
    buttonRowTwo: {
      gap: 10,
    },
    button: {
      borderRadius: 8,
      paddingVertical: 10,
      paddingHorizontal: 18,
      alignItems: "center",
      minWidth: 80,
    },
    closeButton: {
      borderWidth: 1,
      borderColor: palette[PaletteColor.Border],
    },
    closeButtonText: {
      fontSize: 15,
      fontWeight: "600",
      color: palette[PaletteColor.PrimaryText],
    },
    primaryButton: {
      backgroundColor: palette[PaletteColor.Primary],
    },
    primaryButtonText: {
      fontSize: 15,
      fontWeight: "600",
      color: palette[PaletteColor.Surface],
    },
    destructiveButton: {
      backgroundColor: palette[PaletteColor.Error],
    },
    destructiveButtonText: {
      fontSize: 15,
      fontWeight: "600",
      color: "#fff",
    },
  });

export default AppDialog;
