import React, { useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import { AppText, Button } from "@/src/common/ui";
import {
  AnonymizeJob,
  useAnonymizeJobs,
} from "@/src/anonymize/jobs/AnonymizeJobsContext";
import { useActivePatternList } from "@/src/pattern/data/components/ActivePatternListContext";
import { IVideoTranscript } from "@/src/pattern/types/IPatternList";
import { installedModelUri } from "@/src/transcribe/modelStore";
import { SUGGESTION_DOWNLOAD_MB, SUGGESTION_MODEL } from "@/src/suggest/models";
import { canSuggest } from "@/src/suggest/suggestPattern";
import { Suggestion, vocabularyFor } from "@/src/suggest/suggestPrompt";

type Props = {
  listId: string;
  /** For the job's progress line. */
  patternName: string;
  /** The transcribed video; the job finds its pattern by it. */
  sourceUri: string;
  transcript: IVideoTranscript;
  /** Hands the suggestion to the open form, which decides what it may fill. */
  onApply: (suggestion: Suggestion) => void;
};

/** The newest suggest job for this video that is not settled yet. */
const jobFor = (jobs: AnonymizeJob[], sourceUri: string) =>
  jobs.findLast(
    (j) =>
      j.kind === "suggest" && j.sourceUri === sourceUri && j.status !== "done",
  );

/**
 * A suggested name and description for the pattern the transcript teaches (L4), drafted on the
 * phone by a small language model. It says so before the user starts, since the other action in
 * the sheet (copying ticked lines) takes the transcript word for word.
 *
 * The suggestion runs as a job (`jobStore`, kind "suggest"), so the user can close the sheet and
 * keep working: the form's job lines and the pattern list's banner follow it, and offer its
 * review when it is done. While the sheet stays open it shows the same progress and the result.
 * Nothing is filled in until the user taps "Use suggestion", and even then only an empty name
 * is set; the description gets a paragraph of its own. The model is a second, larger download
 * than the speech model, announced with its size first.
 */
const SuggestionPanel: React.FC<Props> = ({
  listId,
  patternName,
  sourceUri,
  transcript,
  onApply,
}) => {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const { activeList, patterns } = useActivePatternList();
  const { jobs, start, settle, forget } = useAnonymizeJobs();
  const [confirm, setConfirm] = useState(false);

  if (!canSuggest() || transcript.segments.length === 0) return null;
  const job = jobFor(jobs, sourceUri);

  const run = () => {
    setConfirm(false);
    if (job?.status === "failed") forget(job.id);
    start({
      kind: "suggest",
      listId,
      patternName,
      request: {
        sourceUri,
        input: {
          transcript: transcript.segments.map((s) => s.text).join(" "),
          language: transcript.language,
          vocabulary: vocabularyFor(activeList, patterns),
        },
      },
    });
  };
  const ask = () => {
    if (installedModelUri(SUGGESTION_MODEL)) run();
    else setConfirm(true);
  };

  const busy = (label: string) => (
    <View style={styles.panel} testID="suggestion-busy">
      <View style={styles.busy}>
        <ActivityIndicator color={theme.colors.primary} />
        <AppText variant="bodySmall" style={styles.flex}>
          {label}
        </AppText>
      </View>
      <AppText variant="caption" color="textMuted">
        {t("suggestLeaveHint")}
      </AppText>
    </View>
  );

  if (!job) {
    if (confirm) {
      return (
        <View style={styles.panel}>
          <AppText variant="bodySmall">
            {t("suggestDownloadHint", { size: SUGGESTION_DOWNLOAD_MB })}
          </AppText>
          <View style={styles.row}>
            <Button
              title={t("cancel")}
              variant="secondary"
              onPress={() => setConfirm(false)}
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
    }
    return (
      <View style={styles.panel}>
        <AppText variant="caption" color="textMuted">
          {t("suggestExplain")}
        </AppText>
        <Button
          title={t("suggestRun")}
          icon="creation"
          variant="secondary"
          onPress={ask}
        />
      </View>
    );
  }

  switch (job.status) {
    case "queued":
      return busy(t("suggestWaiting"));
    case "running":
      return busy(
        job.phase === "download"
          ? t("suggestDownloading", {
              percent: Math.round(job.progress * 100),
            })
          : t("suggestThinking"),
      );
    case "failed":
      return (
        <View style={styles.panel}>
          <AppText variant="bodySmall" color="danger">
            {t("suggestJobInFormFailed", {
              error: job.errorKey ? t(job.errorKey) : (job.error ?? ""),
            })}
          </AppText>
          <Button
            title={t("suggestRetry")}
            icon="refresh"
            variant="secondary"
            onPress={ask}
          />
        </View>
      );
    case "review":
    case "done": {
      const { name = "", description = "" } = job.suggestion ?? {};
      if (!name && !description) {
        return (
          <View style={styles.panel}>
            <AppText variant="bodySmall" color="textMuted">
              {t("suggestNothing")}
            </AppText>
            <Button
              title={t("close")}
              variant="secondary"
              size="sm"
              onPress={() => settle(job.id)}
              style={styles.end}
            />
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
              onPress={() => settle(job.id)}
              style={styles.button}
            />
            <Button
              title={t("suggestApply")}
              icon="check"
              onPress={() => {
                settle(job.id);
                onApply({ name, description });
              }}
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
  end: { alignSelf: "flex-end" },
  flex: { flex: 1 },
  busy: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.space.sm,
  },
}));

export default SuggestionPanel;
