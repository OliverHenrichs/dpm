import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import { getCommonButton } from "@/src/common/utils/CommonStyles";
import {
  DeidentifyJob,
  useDeidentifyJobs,
} from "@/src/deidentify/jobs/DeidentifyJobsContext";

type Props = {
  /**
   * How to open a job's pattern, or undefined when it cannot be found from here (another list,
   * a pattern never saved). A line with an action is shown as a link.
   */
  openAction?: (job: DeidentifyJob) => (() => void) | undefined;
};

/**
 * Where background video jobs report: one line per job, and a dismiss button once none is
 * still running. Renders nothing when there are no jobs.
 */
const DeidentifyJobsBanner: React.FC<Props> = ({ openAction }) => {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const { jobs, dismissFinished } = useDeidentifyJobs();
  if (jobs.length === 0) return null;

  const line = (job: DeidentifyJob) => {
    const name = job.patternName;
    const shorten = job.kind === "shorten";
    switch (job.status) {
      case "queued":
        return t(shorten ? "shortenJobQueued" : "deidentifyJobQueued", {
          name,
        });
      case "running":
        return t(shorten ? "shortenJobRunning" : "deidentifyJobRunning", {
          name,
          percent: Math.round(job.progress * 100),
        });
      case "done":
        return t(shorten ? "shortenJobDone" : "deidentifyJobDone", { name });
      case "failed":
        return t(shorten ? "shortenJobFailed" : "deidentifyJobFailed", {
          name,
          error: job.error ?? "",
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
          <Text
            key={job.id}
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
        );
      })}
      {!busy && (
        <TouchableOpacity
          onPress={dismissFinished}
          accessibilityRole="button"
          style={styles.dismissButton}
        >
          <Text style={styles.dismiss}>{t("deidentifyDismiss")}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
  banner: {
    gap: theme.space.xs,
    padding: theme.space.md,
    marginBottom: theme.space.sm,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  line: { ...theme.typography.bodySmall, color: theme.colors.text },
  link: { textDecorationLine: "underline" },
  dismissButton: {
    ...getCommonButton(theme, theme.colors.border),
    alignSelf: "flex-end",
  },
  dismiss: {
    fontWeight: "bold",
    color: theme.colors.text,
  },
}));

export default DeidentifyJobsBanner;
