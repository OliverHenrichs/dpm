import React from "react";
import { Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import type { ColorTokens } from "@/src/common/theme/tokens";
import { Button, Icon, IconName, ProgressBar } from "@/src/common/ui";
import {
  AnonymizeJob,
  JobStatus,
  writesWithoutCount,
} from "@/src/anonymize/jobs/AnonymizeJobsContext";

type Props = {
  job: AnonymizeJob;
  /** What the job is doing, in the caller's words (the banner names the figure, a form not). */
  title: string;
  /** Opens what the job is on; the title then reads as a link. */
  onTitlePress?: () => void;
  titleHint?: string;
  /** Shown as _Review_ while a result waits. */
  onReview?: () => void;
  /** Shown as _Cancel job_ when the job can still be stopped (`jobStore.canCancel`). */
  onCancel?: () => void;
  /** The cancel button's label for screen readers, when the title alone does not say which. */
  cancelLabel?: string;
};

/** Each kind's glyph, so a line is told apart at a glance. */
const KIND_ICON: Record<AnonymizeJob["kind"], IconName> = {
  anonymize: "incognito",
  shorten: "content-cut",
  transcribe: "text-box-outline",
  suggest: "auto-fix",
};

/** Each status's colour role and label. */
const STATUS: Record<
  JobStatus,
  {
    color: keyof Pick<
      ColorTokens,
      "textMuted" | "primary" | "success" | "danger"
    >;
    key: string;
  }
> = {
  queued: { color: "textMuted", key: "jobStatusQueued" },
  running: { color: "primary", key: "jobStatusRunning" },
  review: { color: "success", key: "jobStatusReview" },
  done: { color: "success", key: "jobStatusDone" },
  failed: { color: "danger", key: "jobStatusFailed" },
};

/**
 * One background job as a card: its kind's icon, what it does, its status, a progress bar
 * while it waits or runs, and its actions. The bar counts where the job reports progress
 * (shorten, anonymize, transcribe, and a suggestion's model download) and sweeps where it
 * cannot (the AI loading and writing). Shared by the jobs banner and the edit forms' lines.
 */
const JobCard: React.FC<Props> = ({
  job,
  title,
  onTitlePress,
  titleHint,
  onReview,
  onCancel,
  cancelLabel,
}) => {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const status = STATUS[job.status];
  const active = job.status === "queued" || job.status === "running";
  const review = job.status === "review" && !!onReview;
  return (
    <View style={styles.card(job.status === "failed")}>
      <View style={styles.header}>
        <View style={styles.iconSlot}>
          <Icon
            name={KIND_ICON[job.kind]}
            size={theme.iconSize.sm}
            color={theme.colors[status.color]}
          />
        </View>
        <Text
          onPress={onTitlePress}
          accessibilityRole={onTitlePress ? "link" : undefined}
          accessibilityHint={onTitlePress ? titleHint : undefined}
          style={[
            styles.title(job.status === "failed"),
            onTitlePress && styles.link,
          ]}
        >
          {title}
        </Text>
        <Text style={styles.status(status.color)}>{t(status.key)}</Text>
      </View>
      {active && (
        <ProgressBar
          // Queued: an empty track. Running: the count, or a sweep without one.
          value={
            job.status === "queued"
              ? 0
              : writesWithoutCount(job)
                ? undefined
                : job.progress
          }
          accessibilityLabel={title}
          style={styles.bar}
        />
      )}
      {(review || onCancel) && (
        <View style={styles.actions}>
          {onCancel && (
            <Button
              title={t("videoJobCancelButton")}
              variant="ghost"
              size="sm"
              onPress={onCancel}
              accessibilityLabel={cancelLabel}
            />
          )}
          {review && (
            <Button
              title={t("videoJobReviewButton")}
              icon="eye-outline"
              size="sm"
              onPress={onReview}
            />
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
  // On `background`: every status colour is held to AA there (tokens.test.ts).
  card: (failed: boolean) => ({
    borderWidth: 1,
    borderRadius: theme.radius.md,
    borderColor: failed ? theme.colors.danger : theme.colors.border,
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.space.md,
    paddingVertical: theme.space.sm,
    gap: theme.space.xs,
  }),
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.space.sm,
  },
  // Level with the title's first line.
  iconSlot: { paddingTop: theme.space.xxs },
  title: (failed: boolean) => ({
    ...theme.typography.bodySmall,
    color: failed ? theme.colors.danger : theme.colors.text,
    flex: 1,
  }),
  link: { textDecorationLine: "underline" },
  status: (color: keyof ColorTokens) => ({
    ...theme.typography.micro,
    color: theme.colors[color],
  }),
  bar: { marginVertical: theme.space.xxs },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: theme.space.sm,
  },
}));

export default JobCard;
