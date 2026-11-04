import React, { useEffect, useRef, useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import { AppText, Button, IconButton } from "@/src/common/ui";
import RevealScrollView from "@/src/common/components/RevealScrollView";
import { RevealTextInput } from "@/src/common/components/reveal";
import {
  getCommonBorder,
  getCommonInput,
  getCommonLabel,
  getCommonRow,
} from "@/src/common/utils/CommonStyles";
import type { Dance } from "@/src/pattern/types/Dance";
import {
  IModifier,
  IPattern,
  ISequence,
  ISequenceStep,
  IVideoReference,
} from "@/src/pattern/types/IPatternList";
import { persistPickedVideos } from "@/src/pattern/data/videoFiles";
import AddVideoModal from "@/src/pattern/list/AddVideoModal";
import { PatternType } from "@/src/pattern/types/PatternType";
import {
  blankFreeStep,
  duplicateStep,
  figureStep,
  freeStep,
  MAX_SEQUENCE_DESCRIPTION,
  MAX_SEQUENCE_NAME,
  MAX_SEQUENCE_STEPS,
  markQueue,
  markStart,
  moveStep,
  sequenceTotals,
  stepName,
  stepVariants,
  withMark,
} from "@/src/pattern/sequences/sequences";
import SequenceStepRow from "@/src/pattern/sequences/SequenceStepRow";
import SequenceTotalsLine from "@/src/pattern/sequences/SequenceTotalsLine";
import StepPicker from "@/src/pattern/sequences/StepPicker";
import { useStepDrag } from "@/src/pattern/sequences/useStepDrag";
import SequenceVideo, {
  videoSeeks,
} from "@/src/pattern/sequences/SequenceVideo";
import SequenceVideoNoSeek from "@/src/pattern/sequences/SequenceVideoNoSeek";
import { useSequencePlayback } from "@/src/pattern/sequences/useSequencePlayback";
import { useFollowStep } from "@/src/pattern/sequences/useFollowStep";
import SequenceVideoTools from "@/src/pattern/sequences/SequenceVideoTools";
import { jobStore } from "@/src/anonymize/jobs/jobStore";
import { applySequenceReplacements } from "@/src/anonymize/jobs/replaceVideo";

/**
 * A run of _Mark steps_: the steps it goes through (by id, `markQueue`), how far it got, and
 * each mark it made with what the step had before, for _Back_.
 */
interface MarkSession {
  /** The video it marks in: a job that replaces the video ends it. */
  video: string;
  queue: string[];
  pos: number;
  undo: { id: string; previous?: number; pos: number }[];
}

interface SequenceFormProps {
  initial: ISequence;
  isNew: boolean;
  patterns: IPattern[];
  patternTypes: PatternType[];
  modifiers: IModifier[];
  dance?: Dance;
  /** Whether it was saved; a refusal keeps the form open with what was typed. */
  onSave: (sequence: ISequence) => Promise<boolean>;
  onCancel: () => void;
}

/**
 * Creating or editing a sequence: name, description, video and steps. Steps are added from the
 * picker at the end, dragged by their grips into order, duplicated and removed; tapping one
 * opens its variant, note and (for a free step) text and counts. Save and Cancel stay outside
 * the scroller, as in every form in a modal.
 *
 * With a video that seeks, it sits pinned above the scroller with _Mark steps_: the video plays
 * and each tap of _Mark_ stores its time as the next step's start. Each step's row then has its
 * mark: the clock marks it alone where the video is, - and + nudge it, its time plays from it.
 * Under the video are the figures' video tools (`SequenceVideoTools`).
 */
const SequenceForm: React.FC<SequenceFormProps> = ({
  initial,
  isNew,
  patterns,
  patternTypes,
  modifiers,
  dance,
  onSave,
  onCancel,
}) => {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const [draft, setDraft] = useState<ISequence>(initial);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [addingVideo, setAddingVideo] = useState(false);
  const [markSession, setSession] = useState<MarkSession | null>(null);
  const nameRef = useRef<TextInput>(null);
  /** A mark waits for the player's time; a second tap meanwhile must not mark the same step. */
  const markBusy = useRef(false);

  const steps = draft.steps;
  const setSteps = (next: ISequenceStep[]) => {
    setDraft((d) => ({ ...d, steps: next }));
    setHint(null);
  };
  /** One step changed from the draft as it is then: marks land after an await. */
  const updateStep = (
    id: string,
    change: (step: ISequenceStep) => ISequenceStep,
  ) =>
    setDraft((d) => ({
      ...d,
      steps: d.steps.map((s) => (s.id === id ? change(s) : s)),
    }));

  const video = draft.video;
  const seeks = !!video && videoSeeks(video);
  const session = markSession?.video === video?.value ? markSession : null;

  // A job on the video that finishes while the form is open replaced it in the stored list,
  // not in this draft: swap it here too, marks and all, so saving does not put it back.
  useEffect(
    () =>
      jobStore.subscribe(() =>
        setDraft((prev) => applySequenceReplacements(prev)),
      ),
    [],
  );
  const playback = useSequencePlayback(steps);
  const scrollRef = useRef<ScrollView>(null);
  const follow = useFollowStep(scrollRef, playback.current, playback.playing);

  const setVideo = (next: IVideoReference | undefined) => {
    setSession(null);
    setDraft((d) => {
      // The marks stay in the draft until Save, which keeps them only with a video.
      const { video: _old, ...rest } = d;
      return next ? { ...rest, video: next } : rest;
    });
  };
  const pickFromLibrary = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["videos"],
      allowsMultipleSelection: false,
    });
    if (result.canceled || !result.assets[0]) return;
    const [value] = await persistPickedVideos([result.assets[0].uri]);
    setVideo({ type: "local", value });
  };
  const addUrl = (url: string, startTime?: number) =>
    setVideo({
      type: "url",
      value: url,
      ...(startTime !== undefined && { startTime }),
    });

  // Mark steps: the next step to mark is the first of the queue from `pos` still in the form.
  const nextMark = session
    ? session.queue.findIndex(
        (id, i) => i >= session.pos && steps.some((s) => s.id === id),
      )
    : -1;
  const nextStepIndex =
    session && nextMark >= 0
      ? steps.findIndex((s) => s.id === session.queue[nextMark])
      : -1;
  const startMarking = () => {
    const queue = markQueue(steps);
    if (!video || queue.length === 0) return;
    setExpandedId(null);
    playback.seekTo(markStart(steps, queue));
    playback.play();
    setSession({ video: video.value, queue, pos: 0, undo: [] });
  };
  const mark = async () => {
    if (!session || nextMark < 0 || markBusy.current) return;
    markBusy.current = true;
    const id = session.queue[nextMark];
    const previous = steps.find((s) => s.id === id)?.at;
    try {
      const seconds = await playback.currentTime();
      updateStep(id, (s) => withMark(s, seconds));
      setSession(
        (m) =>
          m && {
            ...m,
            pos: nextMark + 1,
            undo: [...m.undo, { id, previous, pos: m.pos }],
          },
      );
    } finally {
      markBusy.current = false;
    }
  };
  const unmark = () => {
    const last = session?.undo.at(-1);
    if (!last) return;
    updateStep(last.id, (s) => withMark(s, last.previous));
    setSession((m) => m && { ...m, pos: last.pos, undo: m.undo.slice(0, -1) });
  };
  const stopMarking = () => {
    playback.pause();
    setSession(null);
  };
  const markHere = async (id: string) => {
    const seconds = await playback.currentTime();
    updateStep(id, (s) => withMark(s, seconds));
  };
  const full = steps.length >= MAX_SEQUENCE_STEPS;
  const drag = useStepDrag(
    steps.length,
    theme.space.xs,
    (from, to) => setSteps(moveStep(steps, from, to)),
    true,
  );

  const totals = sequenceTotals(steps, patterns, modifiers, dance);
  const named = !!draft.name.trim();
  const canSave = named && !steps.some(blankFreeStep);

  const add = (step: ISequenceStep, expand: boolean) => {
    if (full) return;
    setSteps([...steps, step]);
    setExpandedId(expand ? step.id : null);
    setPicking(false);
  };

  const explain = () => {
    if (!named) {
      setHint(t("sequenceNameRequired"));
      nameRef.current?.focus();
    } else {
      setHint(t("sequenceFreeStepRequired"));
      setExpandedId(steps.find(blankFreeStep)?.id ?? null);
    }
  };

  const save = async () => {
    if (!canSave) return;
    await onSave(draft);
  };

  return (
    <View style={styles.form}>
      {video && (
        <View>
          <SequenceVideo key={video.value} video={video} {...playback.player} />
          {session ? (
            <View style={styles.markBar}>
              <View style={styles.videoRow}>
                <Button
                  title={t("back")}
                  icon="undo"
                  variant="secondary"
                  size="sm"
                  onPress={unmark}
                  disabled={session.undo.length === 0}
                />
                {nextStepIndex >= 0 ? (
                  <Button
                    title={t("sequenceMarkStep", {
                      n: nextStepIndex + 1,
                      name:
                        stepName(steps[nextStepIndex], patterns) ??
                        t("sequenceFreeStep"),
                    })}
                    icon="gesture-tap"
                    onPress={mark}
                    style={styles.markButton}
                  />
                ) : (
                  <AppText
                    variant="bodySmall"
                    color="textMuted"
                    style={styles.markButton}
                  >
                    {t("sequenceMarkAllDone")}
                  </AppText>
                )}
                <Button
                  title={t("done")}
                  variant="ghost"
                  size="sm"
                  onPress={stopMarking}
                />
              </View>
              <AppText variant="caption" color="textMuted">
                {t("sequenceMarkHint")}
              </AppText>
            </View>
          ) : (
            <View style={styles.videoRow}>
              {seeks ? (
                <Button
                  title={t("sequenceMarkSteps")}
                  icon="clock-outline"
                  variant="outline"
                  size="sm"
                  onPress={startMarking}
                  disabled={steps.length === 0}
                  style={styles.markButton}
                />
              ) : (
                <View style={styles.markButton}>
                  <SequenceVideoNoSeek video={video} />
                </View>
              )}
              <IconButton
                icon="trash-can-outline"
                color="danger"
                size={theme.iconSize.md}
                onPress={() => setVideo(undefined)}
                accessibilityLabel={t("sequenceRemoveVideo")}
              />
            </View>
          )}
          {!session && (
            <SequenceVideoTools
              video={video}
              name={draft.name}
              setDraft={setDraft}
              onOpen={playback.pause}
            />
          )}
        </View>
      )}
      <RevealScrollView
        ref={scrollRef}
        {...follow.scrollProps}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={!drag.holding}
      >
        <View style={styles.container}>
          <Text style={styles.sectionTitle}>
            {isNew ? t("sequenceNew") : t("sequenceEdit")}
          </Text>

          <Text style={styles.label}>{t("sequenceName")}</Text>
          <RevealTextInput
            ref={nameRef}
            placeholder={t("sequenceNamePlaceholder")}
            value={draft.name}
            onChangeText={(name) => {
              setDraft((d) => ({ ...d, name }));
              setHint(null);
            }}
            maxLength={MAX_SEQUENCE_NAME}
            accessibilityLabel={t("sequenceName")}
            style={styles.input}
            placeholderTextColor={theme.colors.textMuted}
          />

          <Text style={styles.label}>{t("sequenceDescription")}</Text>
          <RevealTextInput
            placeholder={t("sequenceDescriptionPlaceholder")}
            value={draft.description ?? ""}
            onChangeText={(description) =>
              setDraft((d) => ({ ...d, description }))
            }
            maxLength={MAX_SEQUENCE_DESCRIPTION}
            multiline
            accessibilityLabel={t("sequenceDescription")}
            style={styles.input}
            placeholderTextColor={theme.colors.textMuted}
          />

          {!video && (
            <>
              <Text style={styles.label}>{t("sequenceVideo")}</Text>
              <AppText variant="caption" color="textMuted">
                {t("sequenceVideoHint")}
              </AppText>
              <Button
                title={t("addVideo")}
                icon="video-plus-outline"
                variant="outline"
                onPress={() => setAddingVideo(true)}
                style={styles.addVideo}
              />
            </>
          )}

          <View style={styles.stepsHeader}>
            <Text style={styles.label}>{t("sequenceSteps")}</Text>
            <SequenceTotalsLine totals={totals} />
          </View>
          <View onLayout={follow.onRowsLayout}>
            {steps.map((step, index) => (
              <SequenceStepRow
                key={step.id}
                step={step}
                index={index}
                patterns={patterns}
                patternTypes={patternTypes}
                modifiers={modifiers}
                current={seeks && index === playback.current}
                onLayout={follow.onRowLayout(index)}
                edit={{
                  expanded: expandedId === step.id,
                  count: steps.length,
                  drag,
                  onToggle: () =>
                    setExpandedId(expandedId === step.id ? null : step.id),
                  onChange: (changed) =>
                    setSteps(
                      steps.map((s) => (s.id === step.id ? changed : s)),
                    ),
                  onDuplicate: () => {
                    if (full)
                      setHint(
                        t("sequenceStepsFull", { max: MAX_SEQUENCE_STEPS }),
                      );
                    else setSteps(duplicateStep(steps, index));
                  },
                  onRemove: () =>
                    setSteps(steps.filter((s) => s.id !== step.id)),
                  onMoveBy: (by) =>
                    setSteps(moveStep(steps, index, index + by)),
                  mark: seeks
                    ? {
                        onMarkHere: () => markHere(step.id),
                        onNudge: (by) =>
                          updateStep(step.id, (s) =>
                            withMark(s, Math.max(0, (s.at ?? 0) + by)),
                          ),
                        onSeek: () => playback.playStep(index),
                      }
                    : undefined,
                }}
              />
            ))}
          </View>
          {steps.length === 0 && (
            <Text style={styles.empty}>{t("sequenceNoSteps")}</Text>
          )}
          <Button
            title={t("sequenceAddStep")}
            icon="plus"
            variant="outline"
            onPress={() => setPicking(true)}
            disabled={full}
            onDisabledPress={() =>
              setHint(t("sequenceStepsFull", { max: MAX_SEQUENCE_STEPS }))
            }
            style={styles.addStep}
          />
        </View>
      </RevealScrollView>
      {hint && (
        <Text style={styles.hint} accessibilityLiveRegion="polite">
          {hint}
        </Text>
      )}
      <View style={styles.buttonRow}>
        <Button
          title={t("cancel")}
          variant="secondary"
          onPress={onCancel}
          style={styles.footerButton}
        />
        <Button
          title={t("sequenceSave")}
          onPress={save}
          disabled={!canSave}
          onDisabledPress={explain}
          style={styles.footerButton}
        />
      </View>
      <AddVideoModal
        visible={addingVideo}
        onClose={() => setAddingVideo(false)}
        onPickFromLibrary={pickFromLibrary}
        onAddUrl={addUrl}
      />
      <StepPicker
        visible={picking}
        patterns={patterns}
        patternTypes={patternTypes}
        onClose={() => setPicking(false)}
        onPickFree={() => add(freeStep(), true)}
        onPickFigure={(pattern) =>
          // A figure with variants opens, so its pill strip offers them under the new step.
          add(
            figureStep(pattern.id),
            stepVariants(pattern, modifiers).length > 0,
          )
        }
      />
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
  form: { flexShrink: 1 },
  container: {
    ...getCommonBorder(theme),
    padding: theme.space.sm,
    backgroundColor: theme.colors.surface,
  },
  sectionTitle: {
    ...theme.typography.title,
    color: theme.colors.text,
    marginBottom: theme.space.sm,
  },
  label: getCommonLabel(theme),
  input: {
    ...getCommonInput(theme),
    marginBottom: theme.space.sm,
  },
  stepsHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: theme.space.sm,
    flexWrap: "wrap",
    marginBottom: theme.space.xs,
  },
  empty: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: theme.space.md,
  },
  addStep: { marginTop: theme.space.sm },
  addVideo: { marginTop: theme.space.xs, marginBottom: theme.space.sm },
  videoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.space.sm,
  },
  markBar: { gap: theme.space.xs },
  markButton: { flex: 1 },
  hint: {
    ...theme.typography.caption,
    color: theme.colors.danger,
    textAlign: "center",
    marginTop: theme.space.sm,
  },
  buttonRow: {
    ...getCommonRow(),
    gap: theme.space.sm,
    marginTop: theme.space.sm,
  },
  footerButton: { flex: 1 },
}));

export default SequenceForm;
