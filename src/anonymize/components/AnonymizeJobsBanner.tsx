import React, { useState } from "react";
import { View } from "react-native";
import { Button } from "@/src/common/ui";
import { StyleSheet } from "react-native-unistyles";
import InfoHint from "@/src/common/components/InfoHint";
import { useTranslation } from "react-i18next";
import {
  AnonymizeJob,
  reviewsSuggestion,
  useAnonymizeJobs,
  writesWithoutCount,
} from "@/src/anonymize/jobs/AnonymizeJobsContext";
import VideoReviewModal from "@/src/anonymize/components/VideoReviewModal";
import JobCard from "@/src/anonymize/components/JobCard";

type Props = {
  /**
   * How to open a job's pattern, or undefined when it cannot be found from here (another list,
   * a pattern never saved). A line with an action is shown as a link.
   */
  openAction?: (job: AnonymizeJob) => (() => void) | undefined;
};

/**
 * Where background video jobs report: one `JobCard` per job (as the edit forms show their
 * own), and a dismiss button once none is still running. A finished video waiting to be
 * checked gets a Review button, which opens it for the user to keep or discard. Renders
 * nothing when there are no jobs.
 */
const AnonymizeJobsBanner: React.FC<Props> = ({ openAction }) => {
  const { t } = useTranslation();
  const { jobs, dismissFinished, cancel, canCancel } = useAnonymizeJobs();
  const [reviewId, setReviewId] = useState<string | null>(null);
  if (jobs.length === 0) return null;
  const reviewing = jobs.find((j) => j.id === reviewId) ?? null;

  const line = (job: AnonymizeJob) => {
    const name = job.patternName;
    const prefix = PREFIX[job.kind];
    switch (job.status) {
      case "queued":
        return t(`${prefix}JobQueued`, { name });
      case "running":
        return writesWithoutCount(job)
          ? t("suggestJobWriting", { name })
          : t(`${prefix}JobRunning`, {
              name,
              percent: Math.round(job.progress * 100),
            });
      case "review":
        return reviewsSuggestion(job)
          ? t("suggestJobReview", { name })
          : t("videoJobReview", { name });
      case "done":
        return t(`${prefix}JobDone`, { name });
      case "failed":
        return t(`${prefix}JobFailed`, {
          name,
          error: job.errorKey ? t(job.errorKey) : (job.error ?? ""),
        });
    }
  };
  const busy = jobs.some(
    (j) => j.status === "queued" || j.status === "running",
  );

  return (
    <View style={styles.banner} testID="anonymize-jobs">
      {jobs.map((job) => {
        const open = openAction?.(job);
        return (
          <JobCard
            key={job.id}
            job={job}
            title={line(job)}
            onTitlePress={open}
            titleHint={t("videoJobOpenPattern")}
            onReview={() => setReviewId(job.id)}
            onCancel={canCancel(job) ? () => cancel(job.id) : undefined}
            cancelLabel={t("videoJobCancel", { name: job.patternName })}
          />
        );
      })}
      {busy && <InfoHint>{t("videoJobsKeepOpen")}</InfoHint>}
      <VideoReviewModal
        job={reviewing?.status === "review" ? reviewing : null}
        onClose={() => setReviewId(null)}
      />
      {!busy && !jobs.every((j) => j.status === "review") && (
        <Button
          title={t("anonymizeDismiss")}
          variant="ghost"
          size="sm"
          onPress={dismissFinished}
          style={styles.dismissButton}
        />
      )}
    </View>
  );
};

/** Each kind's i18n keys: `<prefix>JobQueued`, `…Running`, `…Done`, `…Failed`. */
const PREFIX: Record<AnonymizeJob["kind"], string> = {
  anonymize: "anonymize",
  shorten: "shorten",
  transcribe: "transcribe",
  suggest: "suggest",
};

const styles = StyleSheet.create((theme) => ({
  banner: {
    gap: theme.space.sm,
    padding: theme.space.md,
    marginBottom: theme.space.sm,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  dismissButton: {
    alignSelf: "flex-end",
  },
}));

export default AnonymizeJobsBanner;
