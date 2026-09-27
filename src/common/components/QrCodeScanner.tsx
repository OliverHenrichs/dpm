import React from "react";
import { Modal, Text, View } from "react-native";
import { Button } from "@/src/common/ui";
import { StyleSheet } from "react-native-unistyles";
import { CameraView } from "expo-camera";
import { useTranslation } from "react-i18next";

interface QrCodeScannerProps {
  visible: boolean;
  hint?: string;
  onScanned: (data: string) => void;
  onClose: () => void;
}

const QrCodeScanner: React.FC<QrCodeScannerProps> = ({
  visible,
  hint,
  onScanned,
  onClose,
}) => {
  const { t } = useTranslation();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <CameraView
          style={styles.camera}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={({ data }) => onScanned(data)}
        />
        <View style={styles.overlay}>
          <View style={styles.frame} />
          {hint && <Text style={styles.hint}>{hint}</Text>}
          <Button
            title={t("cancel")}
            icon="close"
            variant="media"
            onPress={onClose}
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.media.black,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    gap: theme.space.xxl,
  },
  frame: {
    width: 220,
    height: 220,
    borderWidth: 3,
    borderColor: theme.media.onScrim,
    borderRadius: theme.radius.xl,
    backgroundColor: "transparent",
  },
  hint: {
    ...theme.typography.bodySmall,
    color: theme.media.onScrim,
    textAlign: "center",
    paddingHorizontal: theme.space.xxxl,
    // react-native-web 0.21 asks for the `textShadow` shorthand instead, but
    // react-native 0.86 still types only these three props. Revisit when RN catches up.
    textShadowColor: theme.media.scrimStrong,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
}));

export default QrCodeScanner;
