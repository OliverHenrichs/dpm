import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useThemeContext } from "@/src/common/components/ThemeContext";
import { getPalette, PaletteColor } from "@/src/common/utils/ColorPalette";
import {
  DeidentifyJob,
  useOptionalDeidentifyJobs,
} from "@/src/deidentify/jobs/DeidentifyJobsContext";

/**
 * Where background de-identification jobs report: one line per job, and a dismiss button once
 * none is still running. Renders nothing when there are no jobs.
 */
const DeidentifyJobsBanner: React.FC = () => {
  const { t } = useTranslation();
  const { colorScheme } = useThemeContext();
  const palette = getPalette(colorScheme);
  const ctx = useOptionalDeidentifyJobs();
  if (!ctx || ctx.jobs.length === 0) return null;
  const { jobs, dismissFinished } = ctx;
  const styles = getStyles(palette);

  const line = (job: DeidentifyJob) => {
    const name = job.patternName;
    switch (job.status) {
      case "queued":
        return t("deidentifyJobQueued", { name });
      case "running":
        return t("deidentifyJobRunning", {
          name,
          percent: Math.round(job.progress * 100),
        });
      case "done":
        return t("deidentifyJobDone", { name });
      case "failed":
        return t("deidentifyJobFailed", { name, error: job.error ?? "" });
    }
  };
  const busy = jobs.some(
    (j) => j.status === "queued" || j.status === "running",
  );

  return (
    <View style={styles.banner} testID="deidentify-jobs">
      {jobs.map((job) => (
        <Text
          key={job.id}
          style={[
            styles.line,
            job.status === "failed" && { color: palette[PaletteColor.Error] },
            job.status === "done" && { color: palette[PaletteColor.Accent] },
          ]}
        >
          {line(job)}
        </Text>
      ))}
      {!busy && (
        <TouchableOpacity onPress={dismissFinished} accessibilityRole="button">
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
    dismiss: {
      fontSize: 13,
      fontWeight: "bold",
      alignSelf: "flex-end",
      color: palette[PaletteColor.Primary],
    },
  });

export default DeidentifyJobsBanner;
