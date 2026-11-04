import React from "react";
import { StyleProp, View, ViewStyle } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import InfoHint from "@/src/common/components/InfoHint";
import {
  AnonymizeJob,
  reviewsSuggestion,
  useAnonymizeJobs,
  writesWithoutCount,
} from "@/src/anonymize/jobs/AnonymizeJobsContext";
import JobCard from "@/src/anonymize/components/JobCard";

type Props = {
  /** The jobs on the form's videos that are not done yet. */
  jobs: AnonymizeJob[];
  /** Opens a finished result for review. */
  onReview: (id: string) => void;
  /** Layout only: the room it keeps from what is around it, when it shows anything. */
  style?: StyleProp<ViewStyle>;
};

/**
 * An edit form's cards for the jobs on its own videos, under them: one `JobCard` per job,
 * naming its kind, its status and progress, with _Review_ once a result waits and _Cancel job_
 * where the job can still be stopped; then, while any runs, a hint to keep the app open.
 * Shared by the figure and the sequence forms.
 */
const DraftJobLines: React.FC<Props> = ({ jobs, onReview, style }) => {
  const { t } = useTranslation();
  const { cancel, canCancel } = useAnonymizeJobs();
  if (jobs.length === 0) return null;

  // Each line names its kind: a transcription that failed for want of sound sat above a cut
  // still running, and "processing" for both read as one job failing and going on.
  const title = (job: AnonymizeJob) => {
    switch (job.status) {
      case "queued":
        return t(`${job.kind}JobInFormQueued`);
      case "running":
        return writesWithoutCount(job)
          ? t("suggestJobInFormWriting")
          : t(`${job.kind}JobInFormRunning`, {
              percent: Math.round(job.progress * 100),
            });
      case "review":
        return reviewsSuggestion(job)
          ? t("suggestJobInFormReview")
          : t("videoJobInFormReview");
      default:
        return t(`${job.kind}JobInFormFailed`, {
          error: job.errorKey ? t(job.errorKey) : (job.error ?? ""),
        });
    }
  };

  return (
    <View style={[styles.list, style]}>
      {jobs.map((job) => (
        <JobCard
          key={job.id}
          job={job}
          title={title(job)}
          onReview={() => onReview(job.id)}
          onCancel={canCancel(job) ? () => cancel(job.id) : undefined}
        />
      ))}
      {jobs.some((j) => j.status === "queued" || j.status === "running") && (
        <InfoHint>{t("videoJobsKeepOpen")}</InfoHint>
      )}
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
  list: { gap: theme.space.sm },
}));

export default DraftJobLines;
