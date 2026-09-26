import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useThemeContext } from "@/src/common/components/ThemeContext";
import { getPalette, PaletteColor } from "@/src/common/utils/ColorPalette";
import { useActivePatternList } from "@/src/pattern/data/components/ActivePatternListContext";
import { IPattern, IVideoReference } from "@/src/pattern/types/IPatternList";
import { DeidentifyTarget } from "@/src/deidentify/components/DeidentifyModal";
import { useOptionalDeidentifyJobs } from "@/src/deidentify/jobs/DeidentifyJobsContext";
import { ALL_PROVIDERS } from "@/src/deidentify/providers/allProviders";
import { availableProviders } from "@/src/deidentify/providers/registry";

type Props = {
  videoRef: IVideoReference;
  pattern: IPattern;
  onOpen: (target: DeidentifyTarget) => void;
};

/**
 * Under a pattern's video: "De-identify…" for a local video that is not already generated, on a
 * list that can be edited — or the progress of the job already working on it. Nothing otherwise
 * (URL videos have no file to process; the native pipeline may be missing, as under jest).
 */
const DeidentifyVideoAction: React.FC<Props> = ({
  videoRef,
  pattern,
  onOpen,
}) => {
  const { t } = useTranslation();
  const { colorScheme } = useThemeContext();
  const palette = getPalette(colorScheme);
  const { activeList } = useActivePatternList();
  const jobs = useOptionalDeidentifyJobs();
  if (!jobs || !activeList || activeList.readonly) return null;
  if (videoRef.type !== "local" || videoRef.generated) return null;
  if (availableProviders(ALL_PROVIDERS).length === 0) return null;

  const job = jobs.jobs.find(
    (j) =>
      j.sourceUri === videoRef.value &&
      (j.status === "queued" || j.status === "running"),
  );
  const styles = getStyles(palette);
  if (job) {
    return (
      <Text style={styles.status}>
        {job.status === "queued"
          ? t("deidentifyJobQueued", { name: pattern.name })
          : t("deidentifyJobRunning", {
              name: pattern.name,
              percent: Math.round(job.progress * 100),
            })}
      </Text>
    );
  }
  return (
    <View style={styles.row}>
      <TouchableOpacity
        onPress={() =>
          onOpen({
            listId: activeList.id,
            patternId: pattern.id,
            patternName: pattern.name,
            sourceUri: videoRef.value,
          })
        }
        accessibilityRole="button"
      >
        <Text style={styles.action}>{t("deidentifyAction")}</Text>
      </TouchableOpacity>
    </View>
  );
};

const getStyles = (palette: Record<PaletteColor, string>) =>
  StyleSheet.create({
    row: { flexDirection: "row", justifyContent: "flex-end", marginTop: 4 },
    action: {
      fontSize: 13,
      fontWeight: "bold",
      color: palette[PaletteColor.Primary],
      padding: 4,
    },
    status: {
      fontSize: 12,
      color: palette[PaletteColor.SecondaryText],
      marginTop: 4,
      textAlign: "right",
    },
  });

export default DeidentifyVideoAction;
