import React from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { IModifier, IPattern } from "@/src/pattern/types/IPatternList";
import { PatternType } from "@/src/pattern/types/PatternType";
import { getPalette, PaletteColor } from "@/src/common/utils/ColorPalette";
import { useThemeContext } from "@/src/common/components/ThemeContext";
import { useTranslation } from "react-i18next";
import PatternDetails from "@/src/pattern/graph/PatternDetails";

interface PatternDetailsModalProps {
  visible: boolean;
  pattern?: IPattern;
  allPatterns: IPattern[];
  patternTypes?: PatternType[];
  modifiers?: IModifier[];
  onClose: () => void;
}

const PatternDetailsModal: React.FC<PatternDetailsModalProps> = ({
  visible,
  pattern,
  allPatterns,
  patternTypes,
  modifiers,
  onClose,
}) => {
  const { t } = useTranslation();
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
        {/* The backdrop sits *behind* the card rather than wrapping it.
            Wrapping it in a press handler — even one that only swallows the
            event — makes that handler claim the touch, and native children
            never get it: the video player's controls stopped responding,
            while the same details rendered in a list row were fine. */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t("dismissDetails")}
        />
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{pattern?.name || ""}</Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel={t("closeDetails")}
            >
              <Icon
                name="close"
                size={24}
                color={palette[PaletteColor.PrimaryText]}
              />
            </TouchableOpacity>
          </View>
          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={styles.modalScrollContent}
          >
            {pattern && (
              <PatternDetails
                selectedPattern={pattern}
                patterns={allPatterns}
                patternTypes={patternTypes}
                modifiers={modifiers}
                palette={palette}
                showTopSeparator={false}
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
      // A ceiling, not a height. The card is as tall as its content until the
      // content would not fit, and only then does the ScrollView start
      // scrolling — a short pattern gets a short card.
      maxHeight: "80%",
      elevation: 5,
      boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.25)",
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
      // React Native's ScrollView puts `flexGrow: 1` on its content container,
      // which makes it fill the parent's whole allowance — here, the full 80%
      // — whatever the content's height. Both of these have to be zero for the
      // card to size itself to what is in it.
      flexGrow: 0,
    },
    modalScrollContent: {
      flexGrow: 0,
      padding: 20,
    },
  });

export default PatternDetailsModal;
