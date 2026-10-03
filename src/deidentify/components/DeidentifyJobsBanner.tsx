import React, { useState } from "react";
import { Text, View } from "react-native";
import { Button, IconButton } from "@/src/common/ui";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import {
  DeidentifyJob,
  useDeidentifyJobs,
} from "@/src/deidentify/jobs/DeidentifyJobsContext";
import VideoReviewModal from "@/src/deidentify/components/VideoReviewModal";

type Props = {
  /**
   * How to open a job's pattern, or undefined when it cannot be found from here (another list,
   * a pattern never saved). A line with an action is shown as a link.
   */
  openAction?: (job: DeidentifyJob) => (() => void) | undefined;
};

/**
 * Where background video jobs report: one line per job, and a dismiss button once none is
 * still running. A finished video waiting to be checked gets a Review button, which opens it
 * for the user to keep or discard. Renders nothing when there are no jobs.
 */
const DeidentifyJobsBanner: React.FC<Props> = ({ openAction }) => {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const { jobs, dismissFinished, cancel, canCancel } = useDeidentifyJobs();
  const [reviewId, setReviewId] = useState<string | null>(null);
  if (jobs.length === 0) return null;
  const reviewing = jobs.find((j) => j.id === reviewId) ?? null;

  const line = (job: DeidentifyJob) => {
    const name = job.patternName;
    const prefix = PREFIX[job.kind];
    switch (job.status) {
      case "queued":
        return t(`${prefix}JobQueued`, { name });
      case "running":
        return t(`${prefix}JobRunning`, {
          name,
          percent: Math.round(job.progress * 100),
        });
      case "review":
        return job.kind === "transcribe"
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
    <View style={styles.banner} testID="deidentify-jobs">
      {jobs.map((job) => {
        const open = openAction?.(job);
        return (
          <View key={job.id} style={styles.row}>
            <Text
              onPress={open}
              accessibilityRole={open ? "link" : undefined}
              accessibilityHint={open ? t("videoJobOpenPattern") : undefined}
              style={[
                styles.line,
                job.status === "failed" && {
                  color: theme.colors.danger,
                },
                job.status === "done" && { color: theme.colors.success },
                open && styles.link,
              ]}
            >
              {line(job)}
            </Text>
            {job.status === "review" && (
              <Button
                title={t("videoJobReviewButton")}
                size="sm"
                onPress={() => setReviewId(job.id)}
              />
            )}
            {canCancel(job) && (
              <IconButton
                icon="close-circle-outline"
                color="textMuted"
                size={theme.iconSize.md}
                onPress={() => cancel(job.id)}
                accessibilityLabel={t("videoJobCancel", {
                  name: job.patternName,
                })}
              />
            )}
          </View>
        );
      })}
      {busy && <Text style={styles.keepOpen}>{t("videoJobsKeepOpen")}</Text>}
      <VideoReviewModal
        job={reviewing?.status === "review" ? reviewing : null}
        onClose={() => setReviewId(null)}
      />
      {!busy && !jobs.every((j) => j.status === "review") && (
        <Button
          title={t("deidentifyDismiss")}
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
const PREFIX: Record<DeidentifyJob["kind"], string> = {
  deidentify: "deidentify",
  shorten: "shorten",
  transcribe: "transcribe",
};

const styles = StyleSheet.create((theme) => ({
  row: { flexDirection: "row", alignItems: "center", gap: theme.space.xs },
  banner: {
    gap: theme.space.xs,
    padding: theme.space.md,
    marginBottom: theme.space.sm,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  line: { ...theme.typography.bodySmall, color: theme.colors.text, flex: 1 },
  link: { textDecorationLine: "underline" },
  keepOpen: { ...theme.typography.caption, color: theme.colors.textMuted },
  dismissButton: {
    alignSelf: "flex-end",
  },
}));

export default DeidentifyJobsBanner;
