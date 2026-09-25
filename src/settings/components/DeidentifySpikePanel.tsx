// SPIKE (L3, branch spike/l3-silhouette) — dev-only entry point, not for merge.
// The real entry point will be a pattern's video; this only hosts the trim panel meanwhile.
import React, { useState } from "react";
import { Button, StyleSheet, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useTranslation } from "react-i18next";
import { VideoItem } from "@/src/common/components/VideoItem";
import { useThemeContext } from "@/src/common/components/ThemeContext";
import { getPalette, PaletteColor } from "@/src/common/utils/ColorPalette";
import DeidentifyTrimPanel from "@/src/deidentify/components/DeidentifyTrimPanel";
import { DeidentifyOutcome } from "@/src/deidentify/providers/DeidentifyProvider";
import { ALL_PROVIDERS } from "@/src/deidentify/providers/allProviders";
import { availableProviders } from "@/src/deidentify/providers/registry";
import {
  setTrackingPlacement,
  setTrackingEvery,
  setTrackingRefine,
} from "@/src/deidentify/providers/onDeviceTracking";

/** Where and how precisely the EdgeTAM graphs run, for comparing on the same clip. */
const TRACKING = ["memcond", "decode", "memorize"];
const GRAPH_PLACEMENTS: {
  label: string;
  cpuGraphs: string[];
  fp32Graphs: string[];
}[] = [
  { label: "GPU fp32 encoder", cpuGraphs: [], fp32Graphs: ["encode"] },
  { label: "GPU fp16", cpuGraphs: [], fp32Graphs: [] },
  { label: "GPU fp32 tracking", cpuGraphs: [], fp32Graphs: TRACKING },
  { label: "GPU fp32 all", cpuGraphs: [], fp32Graphs: ["encode", ...TRACKING] },
  { label: "All CPU", cpuGraphs: ["encode", ...TRACKING], fp32Graphs: [] },
];

const DeidentifySpikePanel: React.FC = () => {
  const { t } = useTranslation();
  const { colorScheme } = useThemeContext();
  const palette = getPalette(colorScheme);
  const [source, setSource] = useState<string | null>(null);
  const [result, setResult] = useState<DeidentifyOutcome | null>(null);
  const [placement, setPlacement] = useState(0);
  const [refine, setRefine] = useState<"bilinear" | "guided">("guided");

  const [every, setEvery] = useState(1);

  const chooseEvery = (n: number) => {
    setEvery(n);
    setTrackingEvery(n);
  };

  const chooseRefine = (r: "bilinear" | "guided") => {
    setRefine(r);
    setTrackingRefine(r);
  };

  const choosePlacement = (i: number) => {
    setPlacement(i);
    setTrackingPlacement(
      GRAPH_PLACEMENTS[i].cpuGraphs,
      GRAPH_PLACEMENTS[i].fp32Graphs,
    );
  };

  const pick = async () => {
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["videos"],
    });
    if (!picked.canceled) {
      setSource(picked.assets[0].uri);
      setResult(null);
    }
  };

  const onDone = (outcome: DeidentifyOutcome) => {
    // logcat cuts lines at ~4000 characters and the per-frame diagnostics are longer, so the
    // stats go out in numbered chunks that `grep '\[deidentify\]'` can reassemble.
    const json = JSON.stringify(outcome);
    const size = 3000;
    const parts = Math.ceil(json.length / size);
    for (let i = 0; i < parts; i++) {
      console.log(
        `[deidentify] ${i + 1}/${parts} ${json.slice(i * size, (i + 1) * size)}`,
      );
    }
    setResult(outcome);
  };

  return (
    <View style={styles.panel}>
      <Text
        style={[styles.title, { color: palette[PaletteColor.PrimaryText] }]}
      >
        {t("deidentifyTitle")}
      </Text>
      <Button title={t("deidentifyPickVideo")} onPress={pick} />
      <View style={styles.row}>
        {GRAPH_PLACEMENTS.map((g, i) => (
          <Button
            key={g.label}
            title={g.label}
            disabled={i === placement}
            onPress={() => choosePlacement(i)}
          />
        ))}
      </View>
      <View style={styles.row}>
        {(["bilinear", "guided"] as const).map((r) => (
          <Button
            key={r}
            title={r === "guided" ? "Edges: guided" : "Edges: bilinear"}
            disabled={r === refine}
            onPress={() => chooseRefine(r)}
          />
        ))}
      </View>
      <View style={styles.row}>
        {[1, 2].map((n) => (
          <Button
            key={n}
            title={n === 1 ? "Track: every frame" : "Track: every 2nd"}
            disabled={n === every}
            onPress={() => chooseEvery(n)}
          />
        ))}
      </View>
      {source && !result && (
        <DeidentifyTrimPanel
          key={source}
          sourceUri={source}
          providers={availableProviders(ALL_PROVIDERS)}
          onDone={onDone}
        />
      )}
      {result && (
        <>
          <Text
            style={[
              styles.stats,
              { color: palette[PaletteColor.SecondaryText] },
            ]}
          >
            {JSON.stringify(result.stats, null, 1)}
          </Text>
          <VideoItem
            key={result.uri}
            videoRef={{ type: "local", value: result.uri }}
            width={320}
          />
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  panel: { gap: 8, marginBottom: 24 },
  title: { fontWeight: "bold", fontSize: 16 },
  stats: { fontFamily: "monospace", fontSize: 11 },
  row: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
});

export default DeidentifySpikePanel;
