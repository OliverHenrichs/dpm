import React from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import ModalOverlay from "@/src/common/components/ModalOverlay";
import { IconButton } from "@/src/common/ui";
import { StyleSheet } from "react-native-unistyles";
import { IModifier, IPattern } from "@/src/pattern/types/IPatternList";
import { PatternType } from "@/src/pattern/types/PatternType";
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

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <ModalOverlay padding="none">
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
            <IconButton
              icon="close"
              color="text"
              onPress={onClose}
              accessibilityLabel={t("closeDetails")}
            />
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
                showTopSeparator={false}
              />
            )}
          </ScrollView>
        </View>
      </ModalOverlay>
    </Modal>
  );
};

const styles = StyleSheet.create((theme) => ({
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.space.none,
    minWidth: "85%",
    // A ceiling, not a height. The card is as tall as its content until the
    // content would not fit, and only then does the ScrollView start
    // scrolling — a short pattern gets a short card.
    maxHeight: "80%",
    ...theme.elevation.md,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: theme.space.xl,
    paddingVertical: theme.space.lg,
    borderBottomWidth: 2,
    borderBottomColor: theme.colors.primary,
  },
  modalTitle: {
    ...theme.typography.headline,
    color: theme.colors.text,
    flex: 1,
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
    padding: theme.space.xl,
  },
}));

export default PatternDetailsModal;
