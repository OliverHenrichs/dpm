import React from "react";
import { Modal, Text, TouchableOpacity, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";

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

const styles = StyleSheet.create((theme) => ({
  overlay: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    justifyContent: "center",
    alignItems: "center",
    padding: theme.space.xxxl,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    padding: theme.space.xxl,
    width: "100%",
    maxWidth: 380,
  },
  title: {
    ...theme.typography.title,
    color: theme.colors.text,
    marginBottom: theme.space.md,
  },
  message: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
    lineHeight: 22,
    marginBottom: theme.space.xxl,
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  buttonRowTwo: {
    gap: theme.space.md,
  },
  button: {
    borderRadius: theme.radius.md,
    paddingVertical: theme.space.md,
    paddingHorizontal: theme.space.xl,
    alignItems: "center",
    minWidth: 80,
  },
  closeButton: {
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  closeButtonText: {
    ...theme.typography.label,
    color: theme.colors.text,
  },
  primaryButton: {
    backgroundColor: theme.colors.primary,
  },
  primaryButtonText: {
    ...theme.typography.label,
    color: theme.colors.onPrimary,
  },
  destructiveButton: {
    backgroundColor: theme.colors.danger,
  },
  destructiveButtonText: {
    ...theme.typography.label,
    color: theme.colors.onDanger,
  },
}));

export default AppDialog;
