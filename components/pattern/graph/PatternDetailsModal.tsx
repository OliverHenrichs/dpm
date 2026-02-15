import React from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { Pattern } from "@/components/pattern/types/PatternList";
import { PatternType } from "@/components/pattern/types/PatternType";
import { getPalette, PaletteColor } from "@/components/common/ColorPalette";
import { useThemeContext } from "@/components/common/ThemeContext";
import PatternDetails from "../common/PatternDetails";

interface PatternDetailsModalProps {
  visible: boolean;
  pattern?: Pattern;
  allPatterns: Pattern[];
  patternTypes?: PatternType[];
  onClose: () => void;
}

const PatternDetailsModal: React.FC<PatternDetailsModalProps> = ({
  visible,
  pattern,
  allPatterns,
  patternTypes,
  onClose,
}) => {
  const { colorScheme } = useThemeContext();
  const palette = getPalette(colorScheme);
  const styles = getStyles(palette);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{pattern?.name || ""}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Icon
                name="close"
                size={24}
                color={palette[PaletteColor.PrimaryText]}
              />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalScroll}>
            {pattern && (
              <PatternDetails
                selectedPattern={pattern}
                patterns={allPatterns}
                patternTypes={patternTypes}
                palette={palette}
              />
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const getStyles = (palette: Record<PaletteColor, string>) =>
  StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "center",
      alignItems: "center",
    },
    modalContent: {
      backgroundColor: palette[PaletteColor.Surface],
      borderRadius: 12,
      padding: 0,
      minWidth: "85%",
      maxHeight: "80%",
      elevation: 5,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
    },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 2,
      borderBottomColor: palette[PaletteColor.Primary],
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: "bold",
      color: palette[PaletteColor.PrimaryText],
      flex: 1,
    },
    closeButton: {
      padding: 4,
    },
    modalScroll: {
      padding: 20,
    },
  });

export default PatternDetailsModal;
