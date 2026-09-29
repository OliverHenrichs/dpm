import React, { useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import { AppText, Button } from "@/src/common/ui";
import { useActivePatternList } from "@/src/pattern/data/components/ActivePatternListContext";
import { IVideoTranscript } from "@/src/pattern/types/IPatternList";
import { downloadModel, installedModelUri } from "@/src/transcribe/modelStore";
import { SUGGESTION_DOWNLOAD_MB, SUGGESTION_MODEL } from "@/src/suggest/models";
import {
  canSuggest,
  suggestPattern,
  SuggestPhase,
} from "@/src/suggest/suggestPattern";
import { Suggestion, vocabularyFor } from "@/src/suggest/suggestPrompt";

type Props = {
  transcript: IVideoTranscript;
  /** Hands the suggestion to the open form, which decides what it may fill. */
  onApply: (suggestion: Suggestion) => void;
};

type State =
  | { step: "idle" }
  | { step: "confirm" }
  | { step: "download"; fraction: number }
  | { step: SuggestPhase }
  | { step: "result"; suggestion: Suggestion }
  | { step: "error"; message: string };

/**
 * A suggested name and description for the pattern the transcript teaches (L4), drafted on the
 * phone by a small language model. Nothing is filled in until the user taps "Use suggestion",
 * and even then only an empty name is set; the description gets a paragraph of its own. The
 * model is a second, larger download than the speech model, announced with its size first.
 */
const SuggestionPanel: React.FC<Props> = ({ transcript, onApply }) => {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const { activeList, patterns } = useActivePatternList();
  const [state, setState] = useState<State>({ step: "idle" });

  if (!canSuggest() || transcript.segments.length === 0) return null;

  const run = async () => {
    try {
      if (!installedModelUri(SUGGESTION_MODEL)) {
        setState({ step: "download", fraction: 0 });
        await downloadModel(SUGGESTION_MODEL, (written) =>
          setState({
            step: "download",
            fraction: written / SUGGESTION_MODEL.bytes,
          }),
        );
      }
      const suggestion = await suggestPattern(
        {
          transcript: transcript.segments.map((s) => s.text).join(" "),
          language: transcript.language,
          vocabulary: vocabularyFor(activeList, patterns),
        },
        (phase) => setState({ step: phase }),
      );
      setState({ step: "result", suggestion });
    } catch {
      setState({ step: "error", message: t("suggestFailed") });
    }
  };
  const start = () => {
    if (installedModelUri(SUGGESTION_MODEL)) void run();
    else setState({ step: "confirm" });
  };

  const busy = (label: string) => (
    <View style={styles.busy}>
      <ActivityIndicator color={theme.colors.primary} />
      <AppText variant="bodySmall" color="textMuted">
        {label}
      </AppText>
    </View>
  );

  switch (state.step) {
    case "idle":
      return (
        <Button
          title={t("suggestRun")}
          icon="lightbulb-on-outline"
          variant="secondary"
          onPress={start}
        />
      );
    case "confirm":
      return (
        <View style={styles.panel}>
          <AppText variant="bodySmall">
            {t("suggestDownloadHint", { size: SUGGESTION_DOWNLOAD_MB })}
          </AppText>
          <View style={styles.row}>
            <Button
              title={t("cancel")}
              variant="secondary"
              onPress={() => setState({ step: "idle" })}
              style={styles.button}
            />
            <Button
              title={t("suggestDownloadAndRun")}
              icon="download"
              onPress={run}
              style={styles.button}
            />
          </View>
        </View>
      );
    case "download":
      return busy(
        t("suggestDownloading", {
          percent: Math.round(state.fraction * 100),
        }),
      );
    case "waiting":
      return busy(t("suggestWaiting"));
    case "loading":
    case "thinking":
      return busy(t("suggestThinking"));
    case "error":
      return (
        <View style={styles.panel}>
          <AppText variant="bodySmall" color="danger">
            {state.message}
          </AppText>
          <Button
            title={t("suggestRetry")}
            icon="refresh"
            variant="secondary"
            onPress={run}
          />
        </View>
      );
    case "result": {
      const { name, description } = state.suggestion;
      if (!name && !description) {
        return (
          <View style={styles.panel}>
            <AppText variant="bodySmall" color="textMuted">
              {t("suggestNothing")}
            </AppText>
          </View>
        );
      }
      return (
        <View style={styles.panel} testID="suggestion">
          {name !== "" && (
            <AppText variant="label">{t("suggestName", { name })}</AppText>
          )}
          {description !== "" && <AppText>{description}</AppText>}
          <AppText variant="caption" color="textMuted">
            {t("suggestApplyHint")}
          </AppText>
          <View style={styles.row}>
            <Button
              title={t("suggestDismiss")}
              variant="secondary"
              onPress={() => setState({ step: "idle" })}
              style={styles.button}
            />
            <Button
              title={t("suggestApply")}
              icon="check"
              onPress={() => onApply(state.suggestion)}
              style={styles.button}
            />
          </View>
        </View>
      );
    }
  }
};

const styles = StyleSheet.create((theme) => ({
  panel: {
    gap: theme.space.sm,
    padding: theme.space.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceVariant,
  },
  row: { flexDirection: "row", flexWrap: "wrap", gap: theme.space.sm },
  button: { flexGrow: 1 },
  busy: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.space.sm,
    paddingVertical: theme.space.sm,
  },
}));

export default SuggestionPanel;
