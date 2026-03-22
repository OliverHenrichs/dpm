import React from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { CameraView } from "expo-camera";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
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
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Icon name="close" size={24} color="#fff" />
            <Text style={styles.closeText}>{t("cancel")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  camera: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    gap: 24,
  },
  frame: {
    width: 220,
    height: 220,
    borderWidth: 3,
    borderColor: "#fff",
    borderRadius: 16,
    backgroundColor: "transparent",
  },
  hint: {
    color: "#fff",
    fontSize: 14,
    textAlign: "center",
    paddingHorizontal: 32,
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  closeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  closeText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default QrCodeScanner;
