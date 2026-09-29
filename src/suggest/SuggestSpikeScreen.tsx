import React, { useEffect, useState } from "react";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { ScrollView, View } from "react-native";
import { Redirect } from "expo-router";
import { StyleSheet } from "react-native-unistyles";
import AppHeader from "@/src/common/components/AppHeader";
import PageContainer from "@/src/common/components/PageContainer";
import { AppText, Button, Card } from "@/src/common/ui";
import { useActivePatternList } from "@/src/pattern/data/components/ActivePatternListContext";
import { GenAiProbeModule } from "@/modules/genai-probe";
import { LLM_MODELS, LlmSpec } from "@/src/suggest/llmModels";
import { deleteLlm, downloadLlm, llmUri } from "@/src/suggest/llmStore";
import { SAMPLES, Sample } from "@/src/suggest/samples";
import {
  parseSuggestion,
  PROMPT_VERSION,
  Suggestion,
  suggestionMessages,
  vocabularyFor,
} from "@/src/suggest/suggestPrompt";
import { releaseLlm, suggestPattern } from "@/src/suggest/suggestPattern";

/**
 * SPIKE (L4 suggestions, AGENT_TASKS.md): runs each small model over the same transcripts and
 * shows name, description and speed side by side. Development builds only, English only, not
 * for merge. Every run is logged as one `[suggest-spike]` JSON line.
 */

type Run = {
  model: string;
  sample: string;
  suggestion?: Suggestion | null;
  stats?: string;
  error?: string;
};

const log = (entry: object) =>
  console.log(`[suggest-spike] ${JSON.stringify(entry)}`);

const SuggestSpikeScreen: React.FC = () => {
  const { activeList, patterns } = useActivePatternList();
  const [installed, setInstalled] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(LLM_MODELS.map((m) => [m.id, llmUri(m) !== null])),
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [runs, setRuns] = useState<Run[]>([]);
  const [nano, setNano] = useState<string>("not checked");

  // A 1–3 GB download or a batch of runs outlasts the screen timeout; a locked phone pauses both.
  useEffect(() => {
    if (!busy) return;
    activateKeepAwakeAsync("suggest-spike").catch(() => undefined);
    return () => {
      deactivateKeepAwake("suggest-spike").catch(() => undefined);
    };
  }, [busy]);

  if (!__DEV__) return <Redirect href="/" />;

  const vocabulary = vocabularyFor(activeList, patterns);
  const inputs: Sample[] = [
    ...SAMPLES,
    ...patterns.flatMap((p) =>
      [...p.videoRefs, ...p.modifierRefs.flatMap((m) => m.videoRefs)]
        .filter((v) => v.transcript && v.transcript.segments.length > 0)
        .map((v, i) => ({
          id: `real-${p.name.trim()}-${i}`,
          language: v.transcript!.language,
          transcript: v.transcript!.segments.map((s) => s.text).join(" "),
          expect: "(real transcript)",
        })),
    ),
  ];

  const download = async (model: LlmSpec) => {
    setBusy(`Downloading ${model.label}`);
    setProgress(0);
    const started = Date.now();
    try {
      await downloadLlm(model, setProgress);
      setInstalled((s) => ({ ...s, [model.id]: true }));
      log({ download: model.id, ms: Date.now() - started });
    } catch (e) {
      setRuns((r) => [
        { model: model.id, sample: "download", error: String(e) },
        ...r,
      ]);
    } finally {
      setBusy(null);
    }
  };

  const runModel = async (model: LlmSpec) => {
    const uri = llmUri(model);
    if (!uri) return;
    for (const sample of inputs) {
      setBusy(`${model.label} · ${sample.id}`);
      try {
        const o = await suggestPattern(model, uri, {
          transcript: sample.transcript,
          language: sample.language,
          vocabulary,
        });
        const stats = `load ${o.loadMs} ms · prompt ${o.promptTokens} tok in ${o.promptMs} ms · ${o.outputTokens} tok at ${o.outputPerSecond}/s · total ${o.totalMs} ms · ${o.lib}`;
        log({
          model: model.id,
          prompt: PROMPT_VERSION,
          sample: sample.id,
          ...o,
        });
        setRuns((r) => [
          {
            model: model.id,
            sample: sample.id,
            suggestion: o.suggestion,
            stats,
          },
          ...r,
        ]);
      } catch (e) {
        log({ model: model.id, sample: sample.id, error: String(e) });
        setRuns((r) => [
          { model: model.id, sample: sample.id, error: String(e) },
          ...r,
        ]);
      }
    }
    setBusy(null);
  };

  const runNano = async () => {
    if (!GenAiProbeModule) return;
    for (const sample of inputs) {
      setBusy(`Gemini Nano · ${sample.id}`);
      const [system, user] = suggestionMessages(
        sample.transcript,
        sample.language,
        vocabulary,
      );
      try {
        const { text, ms } = await GenAiProbeModule.generate(
          `${system.content}\n\n${user.content}\n\nJSON:`,
        );
        log({ model: "gemini-nano", sample: sample.id, raw: text, ms });
        setRuns((r) => [
          {
            model: "gemini-nano",
            sample: sample.id,
            suggestion: parseSuggestion(text),
            stats: `${ms} ms`,
          },
          ...r,
        ]);
      } catch (e) {
        setRuns((r) => [
          { model: "gemini-nano", sample: sample.id, error: String(e) },
          ...r,
        ]);
      }
    }
    setBusy(null);
  };

  return (
    <PageContainer>
      <AppHeader title="Suggest bench" />
      <ScrollView contentContainerStyle={styles.content}>
        <Card>
          <AppText variant="title">Gemini Nano (ML Kit)</AppText>
          <AppText color="textMuted">{nano}</AppText>
          <View style={styles.row}>
            <Button
              title="Check"
              size="sm"
              disabled={!GenAiProbeModule}
              onPress={async () => {
                try {
                  const s = await GenAiProbeModule!.status();
                  setNano(`${s.name} (${s.status})`);
                  log({ nano: s });
                } catch (e) {
                  setNano(String(e));
                  log({ nano: String(e) });
                }
              }}
            />
            <Button
              title="Download"
              size="sm"
              variant="secondary"
              disabled={!GenAiProbeModule}
              onPress={async () => {
                try {
                  setNano(await GenAiProbeModule!.download());
                } catch (e) {
                  setNano(String(e));
                }
              }}
            />
            <Button
              title="Run samples"
              size="sm"
              variant="secondary"
              disabled={busy !== null || !nano.startsWith("available")}
              onPress={runNano}
            />
          </View>
        </Card>

        {LLM_MODELS.map((model) => (
          <Card key={model.id}>
            <AppText variant="title">{model.label}</AppText>
            <AppText color="textMuted">
              {`${(model.bytes / 1e6).toFixed(0)} MB · ${model.license} · ${installed[model.id] ? "installed" : "not downloaded"}`}
            </AppText>
            <View style={styles.row}>
              {installed[model.id] ? (
                <>
                  <Button
                    title="Run samples"
                    size="sm"
                    disabled={busy !== null}
                    onPress={() => runModel(model)}
                  />
                  <Button
                    title="Delete"
                    size="sm"
                    variant="dangerOutline"
                    disabled={busy !== null}
                    onPress={async () => {
                      await releaseLlm();
                      deleteLlm(model);
                      setInstalled((s) => ({ ...s, [model.id]: false }));
                    }}
                  />
                </>
              ) : (
                <Button
                  title="Download"
                  icon="download"
                  size="sm"
                  disabled={busy !== null}
                  onPress={() => download(model)}
                />
              )}
            </View>
          </Card>
        ))}

        {busy && (
          <Card>
            <AppText>{busy}</AppText>
            <AppText variant="caption" color="textMuted">
              {`${Math.round(progress * 100)}%`}
            </AppText>
          </Card>
        )}

        <AppText variant="caption" color="textMuted">
          {`Inputs: ${inputs.map((s) => s.id).join(", ")}`}
        </AppText>

        {runs.map((run, i) => (
          <Card key={`${run.model}-${run.sample}-${i}`}>
            <AppText variant="label">{`${run.model} · ${run.sample}`}</AppText>
            {run.error ? (
              <AppText color="danger">{run.error}</AppText>
            ) : (
              <>
                <AppText variant="bodySmall">
                  {run.suggestion
                    ? `Name: ${run.suggestion.name || "—"}\n${run.suggestion.description || "—"}`
                    : "(unreadable answer)"}
                </AppText>
                <AppText variant="caption" color="textMuted">
                  {run.stats}
                </AppText>
              </>
            )}
          </Card>
        ))}
      </ScrollView>
    </PageContainer>
  );
};

const styles = StyleSheet.create((theme) => ({
  content: { gap: theme.space.md, paddingBottom: theme.space.xxxl },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.space.sm,
    marginTop: theme.space.sm,
  },
}));

export default SuggestSpikeScreen;
