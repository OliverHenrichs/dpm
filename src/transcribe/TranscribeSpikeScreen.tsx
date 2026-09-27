import React, { useState } from "react";
import { ScrollView, View } from "react-native";
import { Redirect } from "expo-router";
import { StyleSheet } from "react-native-unistyles";
import AppHeader from "@/src/common/components/AppHeader";
import PageContainer from "@/src/common/components/PageContainer";
import { AppText, Button, Card, Chip, ListRow } from "@/src/common/ui";
import { useActivePatternList } from "@/src/pattern/data/components/ActivePatternListContext";
import {
  deleteModel,
  ensureModel,
  installedModel,
  WHISPER_MODEL,
} from "@/src/transcribe/modelStore";
import {
  transcribeVideo,
  TranscribeOutcome,
} from "@/src/transcribe/transcribeVideo";
import { vocabularyPrompt } from "@/src/transcribe/vocabulary";

/**
 * L4 spike bench (AGENT_TASKS.md): transcribe the active list's videos and see what Whisper makes
 * of them — speed, detected language, and what the list's vocabulary prompt changes. Development
 * builds only; its strings are not translated on purpose. Every run is also logged under
 * `[transcribe-spike]`, for collecting the measurements from logcat.
 */

type Run = {
  label: string;
  outcome?: TranscribeOutcome;
  error?: string;
};

const LANGUAGES = ["auto", "en", "de", "es"] as const;

const TranscribeSpikeScreen: React.FC = () => {
  const { activeList, patterns } = useActivePatternList();
  const [modelReady, setModelReady] = useState(() => installedModel() !== null);
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [language, setLanguage] = useState<(typeof LANGUAGES)[number]>("auto");
  const [runs, setRuns] = useState<Run[]>([]);

  if (!__DEV__) return <Redirect href="/" />;

  const videos = patterns.flatMap((pattern) =>
    pattern.videoRefs
      .filter((ref) => ref.type === "local")
      .map((ref, i) => ({ pattern, ref, key: `${pattern.id}-${i}` })),
  );
  const prompt = activeList ? vocabularyPrompt(activeList, patterns) : "";

  const download = async () => {
    setBusy("Downloading the model…");
    const started = Date.now();
    try {
      await ensureModel();
      setModelReady(true);
      console.log(
        `[transcribe-spike] model ready in ${Date.now() - started} ms`,
      );
    } catch (e) {
      setRuns((r) => [{ label: "download", error: String(e) }, ...r]);
    } finally {
      setBusy(null);
    }
  };

  const run = async (uri: string, name: string, withPrompt: boolean) => {
    const label = `${name} · ${language} · ${withPrompt ? "with" : "no"} vocabulary`;
    setBusy(`Transcribing ${label}`);
    setProgress(0);
    try {
      const { promise } = await transcribeVideo(uri, {
        language,
        prompt: withPrompt ? prompt : undefined,
        onProgress: setProgress,
      });
      const outcome = await promise;
      console.log(
        `[transcribe-spike] ${label}\n${JSON.stringify(outcome.timing)} lang=${outcome.language}\n` +
          outcome.segments
            .map((s) => `${s.start.toFixed(1)}–${s.end.toFixed(1)} ${s.text}`)
            .join("\n"),
      );
      setRuns((r) => [{ label, outcome }, ...r]);
    } catch (e) {
      console.log(`[transcribe-spike] ${label} failed: ${String(e)}`);
      setRuns((r) => [{ label, error: String(e) }, ...r]);
    } finally {
      setBusy(null);
    }
  };

  const compare = async (uri: string, name: string) => {
    await run(uri, name, false);
    await run(uri, name, true);
  };

  return (
    <PageContainer>
      <AppHeader title="Transcribe spike" />
      <ScrollView contentContainerStyle={styles.content}>
        <Card>
          <AppText variant="title">Model</AppText>
          <AppText color="textMuted">
            {WHISPER_MODEL.id} · {(WHISPER_MODEL.bytes / 1_000_000).toFixed(1)}{" "}
            MB · {modelReady ? "installed" : "not downloaded"}
          </AppText>
          <View style={styles.row}>
            {modelReady ? (
              <Button
                title="Delete model"
                variant="dangerOutline"
                size="sm"
                onPress={() => {
                  deleteModel();
                  setModelReady(false);
                }}
              />
            ) : (
              <Button
                title="Download"
                icon="download"
                size="sm"
                loading={busy !== null}
                onPress={download}
              />
            )}
          </View>
        </Card>

        <Card>
          <AppText variant="title">Language</AppText>
          <View style={styles.row}>
            {LANGUAGES.map((code) => (
              <Chip
                key={code}
                label={code}
                selected={language === code}
                onPress={() => setLanguage(code)}
              />
            ))}
          </View>
          <AppText variant="caption" color="textMuted">
            Vocabulary prompt: {prompt || "(empty)"}
          </AppText>
        </Card>

        {busy && (
          <Card>
            <AppText>{busy}</AppText>
            <AppText variant="caption" color="textMuted">
              {Math.round(progress * 100)}%
            </AppText>
          </Card>
        )}

        <AppText variant="label" color="textMuted">
          VIDEOS IN {activeList?.name?.toUpperCase() ?? "—"}
        </AppText>
        {videos.length === 0 && (
          <AppText color="textMuted">No local videos in this list.</AppText>
        )}
        {videos.map(({ pattern, ref, key }) => (
          <ListRow
            key={key}
            variant="card"
            title={pattern.name}
            subtitle={
              ref.generated ? "silhouette — no audio" : ref.value.slice(-40)
            }
            disabled={busy !== null || !modelReady}
            onPress={() => compare(ref.value, pattern.name)}
            accessibilityHint="Transcribes without and then with the vocabulary prompt"
          />
        ))}

        {runs.map((r, i) => (
          <Card key={`${r.label}-${i}`}>
            <AppText variant="label">{r.label}</AppText>
            {r.error ? (
              <AppText color="danger">{r.error}</AppText>
            ) : (
              r.outcome && (
                <>
                  <AppText variant="caption" color="textMuted">
                    {r.outcome.language} ·{" "}
                    {r.outcome.timing.audioSeconds.toFixed(1)} s audio · extract{" "}
                    {r.outcome.timing.extractMs} ms · load{" "}
                    {r.outcome.timing.loadMs} ms · transcribe{" "}
                    {r.outcome.timing.transcribeMs} ms ·{" "}
                    {r.outcome.timing.speed.toFixed(1)}× real time ·{" "}
                    {r.outcome.timing.gpu ? "GPU" : "CPU"}
                  </AppText>
                  {r.outcome.segments.map((s, j) => (
                    <AppText key={j} variant="bodySmall">
                      {s.start.toFixed(1)}s {s.text}
                    </AppText>
                  ))}
                </>
              )
            )}
          </Card>
        ))}
      </ScrollView>
    </PageContainer>
  );
};

const styles = StyleSheet.create((theme) => ({
  content: {
    gap: theme.space.md,
    paddingBottom: theme.space.xxxl,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.space.sm,
    marginTop: theme.space.sm,
  },
}));

export default TranscribeSpikeScreen;
