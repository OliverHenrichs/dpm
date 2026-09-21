import React from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { PaletteColor } from "@/src/common/utils/ColorPalette";

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  palette: Record<PaletteColor, string>;
  children: React.ReactNode;
  maxHeight?: string;
  minHeight?: string;
}

const BottomSheet: React.FC<BottomSheetProps> = ({
  visible,
  onClose,
  title,
  palette,
  children,
  maxHeight = "80%",
  minHeight = "50%",
}) => {
  const styles = getStyles(palette, maxHeight, minHeight);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable
          style={styles.bottomSheet}
          onPress={(e) => e?.stopPropagation?.()}
        >
          <View style={styles.bottomSheetHeader}>
            <Text style={styles.bottomSheetTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const getStyles = (
  palette: Record<PaletteColor, string>,
  maxHeight: string,
  minHeight: string,
) => {
  return StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      justifyContent: "flex-end" as const,
    },
    bottomSheet: {
      backgroundColor: palette[PaletteColor.Surface],
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingTop: 16,
      paddingHorizontal: 16,
      paddingBottom: 32,
      maxHeight: maxHeight as any,
      minHeight: minHeight as any,
    },
    bottomSheetHeader: {
      flexDirection: "row" as const,
      justifyContent: "space-between" as const,
      alignItems: "center" as const,
      marginBottom: 16,
    },
    bottomSheetTitle: {
      fontSize: 18,
      fontWeight: "bold" as const,
      color: palette[PaletteColor.PrimaryText],
    },
    closeButton: {
      fontSize: 24,
      color: palette[PaletteColor.SecondaryText],
      padding: 4,
    },
  });
};

export default BottomSheet;
