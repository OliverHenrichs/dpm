import React from "react";
import { Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import { Chip } from "@/src/common/ui";
import { RevealTextInput } from "@/src/common/components/reveal";
import { getCommonInput } from "@/src/common/utils/CommonStyles";
import {
  appendChainLink,
  appendRhythmStep,
  lastRhythmStep,
  nextChainLink,
  nextRhythmSteps,
  removeLastRhythmStep,
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
} as const;

/**
 * The rhythm field with its bubbles: the dance's basic rhythms while empty, then the next
 * steps, one more beat rolled onto a chain, and an undo (src/pattern/rhythm/AGENTS.md). Slows
 * and quicks are offered while nothing is written and after slows and quicks, never beside
 * beat numbers. Shared by a figure's rhythm and a variant's own.
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

  const problem = rhythmProblem(value);
  const suggested = value.trim() ? [] : basicRhythms;
  const nextSteps = nextRhythmSteps(value);
  const slowQuick = slowQuickSteps(value);
  // After a triple, one more beat rolled onto it (3&4 → 3&4&5): a rolling count.
  const chainLink = nextChainLink(value);
  // The last step, for the undo chip beside the next steps: a mistap is fixed without the
  // keyboard. Offered for any text, so a typed rhythm that went wrong can be backed out too.
  const lastStep = lastRhythmStep(value);

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
      {(nextSteps.length > 0 ||
        slowQuick.length > 0 ||
        chainLink ||
        lastStep) && (
        <View style={styles.bubbles}>
          {nextSteps.map((step) => (
            <Chip
              key={step}
              label={step}
              icon="plus"
              accessibilityLabel={t("rhythmAddStep", { step })}
              onPress={() => onChange(appendRhythmStep(value, step))}
            />
          ))}
          {chainLink && (
            <Chip
              label={chainLink}
              icon="plus"
              accessibilityLabel={t("rhythmExtendStep", { link: chainLink })}
              onPress={() => onChange(appendChainLink(value, chainLink))}
            />
          )}
          {slowQuick.map((step) => (
            <Chip
              key={step}
              label={step}
              icon="plus"
              accessibilityLabel={t("rhythmAddStep", { step })}
              accessibilityHint={t(
                step === "S" ? "rhythmSlowHint" : "rhythmQuickHint",
              )}
              onPress={() => onChange(appendRhythmStep(value, step))}
            />
          ))}
          {lastStep && (
            <Chip
              label={t("rhythmUndoStep")}
              icon="backspace-outline"
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
  bubbles: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.space.xs,
    marginTop: theme.space.xs,
  },
}));

export default RhythmComposer;
