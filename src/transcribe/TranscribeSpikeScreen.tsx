import React, { useState } from "react";
import { ScrollView, View } from "react-native";
import { Redirect } from "expo-router";
import { StyleSheet } from "react-native-unistyles";
import AppHeader from "@/src/common/components/AppHeader";
import PageContainer from "@/src/common/components/PageContainer";
import { AppText, Button, Card, Chip, ListRow } from "@/src/common/ui";
import { useActivePatternList } from "@/src/pattern/data/components/ActivePatternListContext";
import {
  deleteModels,
  ensureModels,
  installedModels,
} from "@/src/transcribe/modelStore";
import {
  TRANSCRIPTION_DOWNLOAD_BYTES,
  WHISPER_MODEL,
} from "@/src/transcribe/models";
import {
  transcribeVideo,
  TranscribeOutcome,
} from "@/src/transcribe/transcribeVideo";
import { vocabularyPrompt } from "@/src/transcribe/vocabulary";

/**
 * L4 bench (AGENT_TASKS.md): transcribe the active list's videos and see what the engine makes of
 * them. Development builds only, and not part of the feature — the UI phase replaces it. Its
 * strings are not translated on purpose. Every run is logged under `[transcribe-spike]`.
 */

type Run = { label: string; outcome?: TranscribeOutcome; error?: string };

const LANGUAGES = ["auto", "en", "de", "es"] as const;

const TranscribeSpikeScreen: React.FC = () => {
  const { activeList, patterns } = useActivePatternList();
  const [modelsReady, setModelsReady] = useState(
    () => installedModels() !== null,
  );
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
    setBusy("Downloading the models…");
    setProgress(0);
    const started = Date.now();
    try {
      await ensureModels(setProgress);
      setModelsReady(true);
      console.log(
        `[transcribe-spike] models ready in ${Date.now() - started} ms`,
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
      const outcome = await transcribeVideo(uri, {
        language: language === "auto" ? undefined : language,
        prompt: withPrompt ? prompt : undefined,
        onProgress: setProgress,
      }).promise;
      console.log(
        `[transcribe-spike] ${label}\n${JSON.stringify(outcome.timing)} lang=${outcome.transcript.language}\n` +
          outcome.transcript.segments
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
      <AppHeader title="Transcribe bench" />
      <ScrollView contentContainerStyle={styles.content}>
        <Card>
          <AppText variant="title">Models</AppText>
          <AppText color="textMuted">
            {`${WHISPER_MODEL.id} + VAD · ${(TRANSCRIPTION_DOWNLOAD_BYTES / 1_000_000).toFixed(1)} MB · ${modelsReady ? "installed" : "not downloaded"}`}
          </AppText>
          <View style={styles.row}>
            {modelsReady ? (
              <Button
                title="Delete models"
                variant="dangerOutline"
                size="sm"
                onPress={() => {
                  deleteModels();
                  setModelsReady(false);
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
            {`Vocabulary prompt: ${prompt || "(empty)"}`}
          </AppText>
        </Card>

        {busy && (
          <Card>
            <AppText>{busy}</AppText>
            <AppText variant="caption" color="textMuted">
              {`${Math.round(progress * 100)}%`}
            </AppText>
          </Card>
        )}

        <AppText variant="label" color="textMuted">
          {`VIDEOS IN ${activeList?.name?.toUpperCase() ?? "—"}`}
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
              ref.transcript
                ? `transcript: ${ref.transcript.segments.length} lines, ${ref.transcript.language}`
                : ref.generated
                  ? "silhouette — no audio"
                  : ref.value.slice(-40)
            }
            disabled={busy !== null || !modelsReady}
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
              r.outcome && <RunDetails outcome={r.outcome} />
            )}
          </Card>
        ))}
      </ScrollView>
    </PageContainer>
  );
};

const RunDetails: React.FC<{ outcome: TranscribeOutcome }> = ({ outcome }) => {
  const { timing, transcript } = outcome;
  const speed =
    timing.speechSeconds / Math.max(timing.transcribeMs / 1000, 0.001);
  return (
    <>
      <AppText variant="caption" color="textMuted">
        {`${transcript.language} · ${timing.audioSeconds.toFixed(1)} s audio, ${timing.speechSeconds.toFixed(1)} s speech in ${timing.regions} regions · extract ${timing.extractMs} ms · transcribe ${timing.transcribeMs} ms · ${speed.toFixed(1)}× speech time · ${timing.noGpuReason ? `CPU (${timing.noGpuReason})` : "GPU"}`}
      </AppText>
      {transcript.segments.map((s, j) => (
        <AppText key={j} variant="bodySmall">
          {`${s.start.toFixed(1)}s ${s.text}`}
        </AppText>
      ))}
    </>
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
