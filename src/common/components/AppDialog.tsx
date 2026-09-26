import React from "react";
import { Modal, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { AppText, Button } from "@/src/common/ui";

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
        <View style={styles.card} accessibilityRole="alert">
          <AppText variant="title" style={styles.title}>
            {title}
          </AppText>
          <AppText color="textMuted" style={styles.message}>
            {message}
          </AppText>
          <View style={styles.buttonRow}>
            {/* With a confirm action, dismissing is the quiet option beside
                it; alone, it is the dialog's one action. */}
            <Button
              title={closeLabel}
              variant={hasConfirm ? "ghost" : "primary"}
              onPress={onClose}
            />
            {hasConfirm && (
              <Button
                title={confirmLabel}
                variant={confirmDestructive ? "danger" : "primary"}
                onPress={onConfirm}
              />
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
    ...theme.elevation.lg,
  },
  title: {
    marginBottom: theme.space.sm,
  },
  message: {
    marginBottom: theme.space.xxl,
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: theme.space.sm,
  },
}));

export default AppDialog;
