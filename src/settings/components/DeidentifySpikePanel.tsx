// SPIKE (L3, branch spike/l3-silhouette) — throwaway dev-only UI, not for merge.
// Strings are deliberately untranslated.
import React, { useEffect, useState } from "react";
import { Button, StyleSheet, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import {
  DeidentifyMode,
  DeidentifyResult,
  DeidentifySegmenter,
  VideoDeidentifyModule,
} from "@/modules/video-deidentify";
import { VideoItem } from "@/src/common/components/VideoItem";
import { useThemeContext } from "@/src/common/components/ThemeContext";
import { getPalette, PaletteColor } from "@/src/common/utils/ColorPalette";

const RUNS: {
  label: string;
  mode: DeidentifyMode;
  segmenter?: DeidentifySegmenter;
}[] = [
  { label: "Transcode", mode: "passthrough" },
  { label: "Multiclass", mode: "silhouette", segmenter: "multiclass" },
  { label: "DeepLab", mode: "silhouette", segmenter: "deeplab" },
];

const DeidentifySpikePanel: React.FC = () => {
  const { colorScheme } = useThemeContext();
  const palette = getPalette(colorScheme);
  const [source, setSource] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>("");
  const [result, setResult] = useState<DeidentifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sub = VideoDeidentifyModule?.addListener("onProgress", (e) =>
      setProgress(`${e.stage} ${Math.round(e.progress * 100)}%`),
    );
    return () => sub?.remove();
  }, []);

  const pick = async () => {
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["videos"],
    });
    if (!picked.canceled) {
      setSource(picked.assets[0].uri);
      setResult(null);
    }
  };

  const run = async (mode: DeidentifyMode, segmenter?: DeidentifySegmenter) => {
    if (!source || !VideoDeidentifyModule) return;
    setResult(null);
    setError(null);
    try {
      const r = await VideoDeidentifyModule.deidentify(source, {
        maxSeconds: 30,
        height: 720,
        mode,
        segmenter,
      });
      console.log("[deidentify]", JSON.stringify(r));
      setResult(r);
    } catch (e) {
      setError(String(e));
    } finally {
      setProgress("");
    }
  };

  const textColor = { color: palette[PaletteColor.PrimaryText] };
  return (
    <View style={styles.panel}>
      <Text style={[styles.title, textColor]}>Spike: de-identify video</Text>
      <Button
        title={source ? "Pick another video" : "Pick video"}
        onPress={pick}
      />
      {source && (
        <View style={styles.row}>
          {RUNS.map((r) => (
            <Button
              key={r.label}
              title={r.label}
              disabled={!!progress}
              onPress={() => run(r.mode, r.segmenter)}
            />
          ))}
        </View>
      )}
      {!!progress && <Text style={textColor}>{progress}</Text>}
      {error && <Text style={{ color: "red" }}>{error}</Text>}
      {result && (
        <>
          <Text style={[styles.stats, textColor]}>
            {JSON.stringify({ ...result, uri: undefined }, null, 1)}
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
  row: { flexDirection: "row", gap: 8 },
  stats: { fontFamily: "monospace", fontSize: 11 },
});

export default DeidentifySpikePanel;
