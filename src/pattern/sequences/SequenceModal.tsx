import React, { useRef, useState } from "react";
import { Modal, ScrollView, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StyleSheet } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import ModalOverlay from "@/src/common/components/ModalOverlay";
import {
  getCommonBorder,
  getCommonFormSheet,
  getCommonRow,
} from "@/src/common/utils/CommonStyles";
import { Button, Chip } from "@/src/common/ui";
import { ISequence } from "@/src/pattern/types/IPatternList";
import { usePatternCrud } from "@/src/pattern/list/hooks/usePatternCrud";
import { sequenceTotals } from "@/src/pattern/sequences/sequences";
import SequenceForm from "@/src/pattern/sequences/SequenceForm";
import SequenceStepRow from "@/src/pattern/sequences/SequenceStepRow";
import SequenceTotalsLine from "@/src/pattern/sequences/SequenceTotalsLine";
import SequenceVideo, {
  videoSeeks,
} from "@/src/pattern/sequences/SequenceVideo";
import SequenceVideoNoSeek from "@/src/pattern/sequences/SequenceVideoNoSeek";
import { useSequencePlayback } from "@/src/pattern/sequences/useSequencePlayback";
import { useFollowStep } from "@/src/pattern/sequences/useFollowStep";
import TranscriptSheet from "@/src/transcribe/components/TranscriptSheet";

/** Which sequence is open, and how: `draft` is a new one, not on the list until saved. */
export interface OpenSequence {
  id: string;
  editing: boolean;
  draft?: ISequence;
}

interface SequenceModalProps {
  open: OpenSequence | null;
  onClose: () => void;
}

/**
 * A sequence, opened from the List tab's Sequences: its video, its steps as a numbered list with
 * the totals and description, and behind _Edit_ the form, in the same sheet, as with figures. A
 * read-only list has no _Edit_. A new sequence opens straight in the form; Cancel then closes.
 */
const SequenceModal: React.FC<SequenceModalProps> = ({ open, onClose }) => (
  <Modal
    visible={open !== null}
    animationType="slide"
    transparent
    onRequestClose={onClose}
  >
    {/* The steps' grips are Gesture Handler pans, which need a root inside a Modal. */}
    <GestureHandlerRootView style={styles.root}>
      <ModalOverlay padding="none">
        <View style={styles.modalContent}>
          {open && (
            <SequenceSheet key={open.id} open={open} onClose={onClose} />
          )}
        </View>
      </ModalOverlay>
    </GestureHandlerRootView>
  </Modal>
);

const SequenceSheet: React.FC<{
  open: OpenSequence;
  onClose: () => void;
}> = ({ open, onClose }) => {
  const {
    activeList,
    patterns,
    patternTypes,
    modifiers,
    sequences,
    isReadonly,
    saveSequence,
  } = usePatternCrud();
  const [editing, setEditing] = useState(open.editing && !isReadonly);
  const saved = sequences.find((s) => s.id === open.id);
  const sequence = saved ?? open.draft;
  if (!sequence) return null;

  if (editing) {
    return (
      <SequenceForm
        initial={sequence}
        isNew={!saved}
        patterns={patterns}
        patternTypes={patternTypes}
        modifiers={modifiers}
        dance={activeList?.dance}
        sequences={sequences}
        onSave={async (edited) => {
          const accepted = await saveSequence(edited);
          if (accepted) setEditing(false);
          return accepted;
        }}
        onCancel={() => (saved ? setEditing(false) : onClose())}
      />
    );
  }

  return (
    <SequenceView
      sequence={sequence}
      onClose={onClose}
      onEdit={isReadonly ? undefined : () => setEditing(true)}
    />
  );
};

/**
 * A sequence as it is danced: the video pinned above the steps, which light up as it plays and
 * stay in view; tapping a marked step plays from it, and _Loop step_ repeats one. A transcribed
 * video shows its transcript read-only, as a figure's details do. A read-only list plays and
 * seeks the same, without _Edit_.
 */
const SequenceView: React.FC<{
  sequence: ISequence;
  onClose: () => void;
  onEdit?: () => void;
}> = ({ sequence, onClose, onEdit }) => {
  const { t } = useTranslation();
  const { activeList, patterns, patternTypes, modifiers } = usePatternCrud();
  const playback = useSequencePlayback(sequence.steps);
  const scrollRef = useRef<ScrollView>(null);
  const follow = useFollowStep(scrollRef, playback.current, playback.playing);
  const video = sequence.video;
  const seeks = !!video && videoSeeks(video);
  const marked = sequence.steps.some((step) => step.at !== undefined);
  const [showTranscript, setShowTranscript] = useState(false);
  const transcript = video?.transcript;

  const totals = sequenceTotals(
    sequence.steps,
    patterns,
    modifiers,
    activeList?.dance,
  );
  return (
    <View style={styles.form}>
      {video && (
        <>
          <SequenceVideo video={video} {...playback.player} />
          {!seeks && (
            <SequenceVideoNoSeek video={video} style={styles.noSeek} />
          )}
          {((seeks && marked) || transcript) && (
            <View style={styles.playRow}>
              {seeks && marked && (
                <Chip
                  label={t("sequenceLoopStep")}
                  icon="repeat"
                  toggle
                  selected={playback.loopId !== null}
                  onPress={playback.toggleLoop}
                />
              )}
              {transcript && (
                <Chip
                  label={t("transcriptShow")}
                  icon="text-box-outline"
                  onPress={() => {
                    playback.pause();
                    setShowTranscript(true);
                  }}
                />
              )}
            </View>
          )}
        </>
      )}
      <TranscriptSheet
        target={
          showTranscript && video && transcript
            ? {
                patternName: sequence.name,
                sourceUri: video.value,
                transcript,
                hasSound: !video.generated,
              }
            : null
        }
        onClose={() => setShowTranscript(false)}
      />
      <ScrollView ref={scrollRef} {...follow.scrollProps}>
        <View style={styles.container}>
          <Text style={styles.title}>{sequence.name}</Text>
          <SequenceTotalsLine totals={totals} style={styles.totals} />
          {sequence.description ? (
            <Text style={styles.description}>{sequence.description}</Text>
          ) : null}
          <View onLayout={follow.onRowsLayout}>
            {sequence.steps.map((step, index) => (
              <SequenceStepRow
                key={step.id}
                step={step}
                index={index}
                patterns={patterns}
                patternTypes={patternTypes}
                modifiers={modifiers}
                current={seeks && index === playback.current}
                onLayout={follow.onRowLayout(index)}
                onPlay={seeks ? () => playback.playStep(index) : undefined}
              />
            ))}
          </View>
          {sequence.steps.length === 0 && (
            <Text style={styles.empty}>{t("sequenceNoSteps")}</Text>
          )}
        </View>
      </ScrollView>
      <View style={styles.buttonRow}>
        <Button
          title={t("close")}
          variant="secondary"
          onPress={onClose}
          style={styles.footerButton}
        />
        {onEdit && (
          <Button
            title={t("sequenceEditButton")}
            icon="pencil"
            onPress={onEdit}
            style={styles.footerButton}
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
  root: { flex: 1 },
  modalContent: getCommonFormSheet(theme),
  form: { flexShrink: 1 },
  container: {
    ...getCommonBorder(theme),
    padding: theme.space.sm,
    backgroundColor: theme.colors.surface,
  },
  title: {
    ...theme.typography.title,
    color: theme.colors.text,
  },
  totals: { marginBottom: theme.space.sm },
  description: {
    ...theme.typography.bodySmall,
    color: theme.colors.text,
    marginBottom: theme.space.sm,
  },
  empty: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: theme.space.md,
  },
  buttonRow: {
    ...getCommonRow(),
    gap: theme.space.sm,
    marginTop: theme.space.sm,
  },
  footerButton: { flex: 1 },
  noSeek: { marginBottom: theme.space.sm },
  playRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.space.sm,
    marginBottom: theme.space.sm,
  },
}));

export default SequenceModal;
