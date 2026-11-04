import React, { useRef, useState } from "react";
import { Text, TextInput, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import { Button } from "@/src/common/ui";
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
} from "@/src/pattern/types/IPatternList";
import { PatternType } from "@/src/pattern/types/PatternType";
import {
  blankFreeStep,
  duplicateStep,
  figureStep,
  freeStep,
  MAX_SEQUENCE_DESCRIPTION,
  MAX_SEQUENCE_NAME,
  MAX_SEQUENCE_STEPS,
  moveStep,
  sequenceTotals,
  stepVariants,
} from "@/src/pattern/sequences/sequences";
import SequenceStepRow from "@/src/pattern/sequences/SequenceStepRow";
import SequenceTotalsLine from "@/src/pattern/sequences/SequenceTotalsLine";
import StepPicker from "@/src/pattern/sequences/StepPicker";
import { useStepDrag } from "@/src/pattern/sequences/useStepDrag";

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
 * Creating or editing a sequence: name, description and steps. Steps are added from the picker
 * at the end, dragged by their grips into order, duplicated and removed; tapping one opens its
 * variant, note and (for a free step) text and counts. Save and Cancel stay outside the
 * scroller, as in every form in a modal.
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
  const nameRef = useRef<TextInput>(null);

  const steps = draft.steps;
  const setSteps = (next: ISequenceStep[]) => {
    setDraft((d) => ({ ...d, steps: next }));
    setHint(null);
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
      <RevealScrollView
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

          <View style={styles.stepsHeader}>
            <Text style={styles.label}>{t("sequenceSteps")}</Text>
            <SequenceTotalsLine totals={totals} />
          </View>
          <View>
            {steps.map((step, index) => (
              <SequenceStepRow
                key={step.id}
                step={step}
                index={index}
                patterns={patterns}
                patternTypes={patternTypes}
                modifiers={modifiers}
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
