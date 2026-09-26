import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useThemeContext } from "@/src/common/components/ThemeContext";
import { getPalette, PaletteColor } from "@/src/common/utils/ColorPalette";
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
  const { colorScheme } = useThemeContext();
  const palette = getPalette(colorScheme);
  const { jobs, dismissFinished } = useDeidentifyJobs();
  if (jobs.length === 0) return null;
  const styles = getStyles(palette);

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
              job.status === "failed" && { color: palette[PaletteColor.Error] },
              job.status === "done" && { color: palette[PaletteColor.Accent] },
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

const getStyles = (palette: Record<PaletteColor, string>) =>
  StyleSheet.create({
    banner: {
      gap: 4,
      padding: 10,
      marginBottom: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: palette[PaletteColor.Border],
      backgroundColor: palette[PaletteColor.Surface],
    },
    line: { fontSize: 13, color: palette[PaletteColor.PrimaryText] },
    link: { textDecorationLine: "underline" },
    dismissButton: {
      ...getCommonButton(palette, palette[PaletteColor.Border]),
      alignSelf: "flex-end",
    },
    dismiss: {
      fontWeight: "bold",
      color: palette[PaletteColor.PrimaryText],
    },
  });

export default DeidentifyJobsBanner;
