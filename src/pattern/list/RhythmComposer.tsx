import React, { useState } from "react";
import { Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import { Chip } from "@/src/common/ui";
import { RevealTextInput } from "@/src/common/components/reveal";
import { getCommonInput } from "@/src/common/utils/CommonStyles";
import {
  appendRhythmElement,
  appendRhythmStep,
  lastRhythmStep,
  nextRhythmElements,
  removeLastRhythmStep,
  rhythmElementText,
  rhythmProblem,
  slowQuickSteps,
} from "@/src/pattern/rhythm/rhythm";

type RhythmComposerProps = {
  /** What is typed so far; it may not be a rhythm yet. */
  value: string;
  /** Every change, typed or tapped. The host keeps counts and rhythm matched. */
  onChange: (text: string) => void;
  /** Whole rhythms offered while the field is empty, one tap each (`basicRhythms`). */
  basicRhythms: string[];
  placeholder: string;
  accessibilityLabel: string;
};

const PROBLEM_KEYS = {
  invalid: "rhythmInvalid",
  mixed: "rhythmMixedNotation",
  slowQuickJoin: "rhythmSlowQuickJoin",
  markOrder: "rhythmMarkOrder",
  markSplit: "rhythmMarkSplit",
} as const;

/**
 * The rhythm field with its bubbles: the dance's basic rhythms while empty, then one element at
 * a time (the next beat, `&`, `a`), a one-shot _Pause_ that adds the next one held, and an undo, the last two pinned right as signs
 * (src/pattern/rhythm/AGENTS.md). Slows and quicks are offered while nothing is written and
 * after slows and quicks, never beside beat numbers. Shared by a figure's rhythm and a
 * variant's own.
 */
const RhythmComposer: React.FC<RhythmComposerProps> = ({
  value,
  onChange,
  basicRhythms,
  placeholder,
  accessibilityLabel,
}) => {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  // Like a phone's shift key: it holds the next element tapped, then turns itself off.
  const [pause, setPause] = useState(false);

  const problem = rhythmProblem(value);
  const suggested = value.trim() ? [] : basicRhythms;
  const nextElements = nextRhythmElements(value);
  const slowQuick = slowQuickSteps(value);
  // The last element, for the undo chip beside the next ones: a mistap is fixed without the
  // keyboard. Offered for any text, so a typed rhythm that went wrong can be backed out too.
  const lastStep = lastRhythmStep(value);
  const held = pause && nextElements.length > 0;

  const add = (text: string) => {
    setPause(false);
    onChange(text);
  };

  return (
    <View style={styles.block}>
      <RevealTextInput
        placeholder={placeholder}
        value={value}
        onChangeText={onChange}
        accessibilityLabel={accessibilityLabel}
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.input}
        placeholderTextColor={theme.colors.textMuted}
      />
      {problem && <Text style={styles.error}>{t(PROBLEM_KEYS[problem])}</Text>}
      {suggested.length > 0 && (
        <View style={styles.bubbles}>
          {suggested.map((rhythm) => (
            <Chip
              key={rhythm}
              label={rhythm}
              icon="music-note-outline"
              accessibilityHint={t("rhythmSuggestionHint")}
              onPress={() => onChange(rhythm)}
            />
          ))}
        </View>
      )}
      {(nextElements.length > 0 || slowQuick.length > 0 || lastStep) && (
        <View style={styles.composeRow}>
          <View style={[styles.bubbles, styles.steps]}>
            {nextElements.map((element) => {
              const step = rhythmElementText(element);
              return (
                <Chip
                  key={step}
                  label={rhythmElementText(element, held)}
                  icon="plus"
                  accessibilityLabel={t(
                    held ? "rhythmAddPausedStep" : "rhythmAddStep",
                    { step },
                  )}
                  onPress={() => add(appendRhythmElement(value, element, held))}
                />
              );
            })}
            {slowQuick.map((step) => (
              <Chip
                key={step}
                label={step}
                icon="plus"
                accessibilityLabel={t("rhythmAddStep", { step })}
                accessibilityHint={t(
                  step === "S" ? "rhythmSlowHint" : "rhythmQuickHint",
                )}
                onPress={() => add(appendRhythmStep(value, step))}
              />
            ))}
          </View>
          {/* Pinned to the right, so they stay put while the pills before them change. */}
          {nextElements.length > 0 && (
            <Chip
              label={t("rhythmPause")}
              icon="pause"
              iconOnly
              toggle
              selected={held}
              accessibilityHint={t("rhythmPauseHint")}
              onPress={() => setPause(!held)}
            />
          )}
          {lastStep && (
            <Chip
              label={t("rhythmUndoStep")}
              icon="backspace-outline"
              iconOnly
              accessibilityLabel={t("rhythmRemoveStep", { step: lastStep })}
              onPress={() => onChange(removeLastRhythmStep(value))}
            />
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
  block: { marginBottom: theme.space.sm },
  input: { ...getCommonInput(theme) },
  error: {
    ...theme.typography.caption,
    color: theme.colors.danger,
    marginTop: theme.space.xxs,
  },
  composeRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.space.xs,
    marginTop: theme.space.xs,
  },
  steps: { flex: 1, marginTop: 0 },
  bubbles: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.space.xs,
    marginTop: theme.space.xs,
  },
}));

export default RhythmComposer;
