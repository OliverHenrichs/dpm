import React from "react";
import { Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import { Button } from "@/src/common/ui";
import { getCommonRow } from "@/src/common/utils/CommonStyles";
import {
  AnonymizeJob,
  reviewsSuggestion,
  writesWithoutCount,
} from "@/src/anonymize/jobs/AnonymizeJobsContext";

type Props = {
  /** The jobs on the form's videos that are not done yet. */
  jobs: AnonymizeJob[];
  /** Opens a finished result for review. */
  onReview: (id: string) => void;
};

/**
 * An edit form's lines for the jobs on its own videos, under them: one per job, naming its kind
 * and how far it got, a Review button once a result waits, and a reminder to keep the app open
 * while any runs. Shared by the figure and the sequence forms.
 */
const DraftJobLines: React.FC<Props> = ({ jobs, onReview }) => {
  const { t } = useTranslation();
  return (
    <>
      {jobs.map((job) =>
        job.status === "review" ? (
          <View key={job.id} style={styles.jobRow}>
            <Text style={[styles.jobLine, styles.jobRowText]}>
              {reviewsSuggestion(job)
                ? t("suggestJobInFormReview")
                : t("videoJobInFormReview")}
            </Text>
            <Button
              title={t("videoJobReviewButton")}
              size="sm"
              onPress={() => onReview(job.id)}
            />
          </View>
        ) : (
          // Each line names its kind: a transcription that failed for want of sound sat above
          // a cut still running, and "processing" for both read as one job failing and going on.
          <Text
            key={job.id}
            style={[
              styles.jobLine,
              job.status === "failed" && styles.jobLineFailed,
            ]}
          >
            {job.status === "queued"
              ? t(`${job.kind}JobInFormQueued`)
              : job.status === "running"
                ? writesWithoutCount(job)
                  ? t("suggestJobInFormWriting")
                  : t(`${job.kind}JobInFormRunning`, {
                      percent: Math.round(job.progress * 100),
                    })
                : t(`${job.kind}JobInFormFailed`, {
                    error: job.errorKey ? t(job.errorKey) : (job.error ?? ""),
                  })}
          </Text>
        ),
      )}
      {jobs.some((j) => j.status === "queued" || j.status === "running") && (
        <Text style={styles.jobLine}>{t("videoJobsKeepOpen")}</Text>
      )}
    </>
  );
};

const styles = StyleSheet.create((theme) => ({
  jobLine: {
    ...theme.typography.caption,
    marginBottom: theme.space.sm,
    color: theme.colors.textMuted,
  },
  jobLineFailed: { color: theme.colors.danger },
  jobRow: {
    ...getCommonRow(),
    gap: theme.space.sm,
    marginBottom: theme.space.sm,
  },
  jobRowText: { flex: 1, marginBottom: 0 },
}));

export default DraftJobLines;
