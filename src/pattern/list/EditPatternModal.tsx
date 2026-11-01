import React, { useState } from "react";
import { Modal, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import ModalOverlay from "@/src/common/components/ModalOverlay";
import RevealScrollView from "@/src/common/components/RevealScrollView";
import { getCommonFormSheet } from "@/src/common/utils/CommonStyles";
import EditPatternForm from "@/src/pattern/list/EditPatternForm";
import { usePatternCrud } from "@/src/pattern/list/hooks/usePatternCrud";
import { IPattern, NewPattern } from "@/src/pattern/types/IPatternList";

interface PatternFormModalProps {
  visible: boolean;
  onRequestClose: () => void;
  children: React.ReactNode;
}

/** The sheet the figure form opens in, adding or editing: a slide-up modal with a scroller. */
export const PatternFormModal: React.FC<PatternFormModalProps> = ({
  visible,
  onRequestClose,
  children,
}) => (
  <Modal
    visible={visible}
    animationType="slide"
    transparent
    onRequestClose={onRequestClose}
  >
    <ModalOverlay padding="none">
      <View style={styles.modalContent}>
        <RevealScrollView
          // Tapping a rhythm step keeps the keyboard up, so typing can go on.
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1 }}
        >
          {children}
        </RevealScrollView>
      </View>
    </ModalOverlay>
  </Modal>
);

/**
 * Which figure is open in the edit form, and how it is opened and closed: the List tab's row
 * and the Map's details share it. `startEditing` refuses on a read-only list, as the save would.
 */
export function usePatternEditing(): {
  editing: IPattern | null;
  startEditing: (pattern: IPattern) => void;
  stopEditing: () => void;
} {
  const { isReadonly } = usePatternCrud();
  const [editing, setEditing] = useState<IPattern | null>(null);
  return {
    editing,
    startEditing: (pattern) => {
      if (!isReadonly) setEditing(pattern);
    },
    stopEditing: () => setEditing(null),
  };
}

interface EditPatternModalProps {
  /** The figure to edit; null keeps the sheet closed. */
  pattern: IPattern | null;
  /** Called on cancel, on the back button, and after a save went through. */
  onClose: () => void;
}

/**
 * The figure form on an existing figure, saved through `usePatternCrud.editPattern` like every
 * edit. A refused save (a blank name) keeps the form open with what was typed.
 */
const EditPatternModal: React.FC<EditPatternModalProps> = ({
  pattern,
  onClose,
}) => {
  const { patterns, patternTypes, modifiers, editPattern, addPatternType } =
    usePatternCrud();

  const handleSave = async (edited: NewPattern | IPattern) => {
    const accepted = await editPattern(edited);
    if (accepted) onClose();
    return accepted;
  };

  return (
    <PatternFormModal visible={pattern !== null} onRequestClose={onClose}>
      <EditPatternForm
        key={pattern?.id}
        patterns={patterns}
        patternTypes={patternTypes}
        modifiers={modifiers}
        onAccepted={handleSave}
        onCancel={onClose}
        onAddType={addPatternType}
        existing={pattern}
      />
    </PatternFormModal>
  );
};

const styles = StyleSheet.create((theme) => ({
  modalContent: getCommonFormSheet(theme),
}));

export default EditPatternModal;
