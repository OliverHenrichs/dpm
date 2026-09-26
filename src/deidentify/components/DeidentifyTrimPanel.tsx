import React, { useState } from "react";
import {
  GestureResponderEvent,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useEventListener } from "expo";
import { useVideoPlayer, VideoView } from "expo-video";
import { useTranslation } from "react-i18next";
import { useThemeContext } from "@/src/common/components/ThemeContext";
import { getPalette, PaletteColor } from "@/src/common/utils/ColorPalette";
import { getCommonButton, getCommonRow } from "@/src/common/utils/CommonStyles";
import TrimWindowBar from "@/src/deidentify/components/TrimWindowBar";
import {
  Point,
  Size,
  tapToVideoPoint,
  videoPointToView,
} from "@/src/deidentify/model/promptPoints";
import {
  canTrim,
  fitWindow,
  initialWindow,
  TrimLimits,
  TrimWindow,
} from "@/src/deidentify/model/trimWindow";
import {
  DeidentifyOutcome,
  DeidentifyProvider,
  DeidentifyRequest,
} from "@/src/deidentify/providers/DeidentifyProvider";
import { runDeidentify } from "@/src/deidentify/runDeidentify";

type Props = {
  sourceUri: string;
  /** Providers that can run here; see `availableProviders`. */
  providers: DeidentifyProvider[];
  onDone?: (outcome: DeidentifyOutcome) => void;
  /**
   * Hands the configured run to the caller instead of running it here — the app starts it as a
   * background job (DeidentifyJobsContext) and closes the panel.
   */
  onRun?: (provider: DeidentifyProvider, request: DeidentifyRequest) => void;
};

/** The output palette's dancer colours, so a marker shows which colour that dancer gets. */
const DANCER_COLOURS = ["#F59E0B", "#14B8A6"];
const MARKER = 28;

/**
 * Pick the part of a clip to de-identify and run a provider on it. The preview loops the
 * selected window, so what you see is what gets processed. A provider that tracks from a
 * prompt pauses the preview on the window's first frame instead, for one tap per dancer.
 *
 * Remote providers are not offered a consent step yet — `runDeidentify` refuses them without
 * one, so adding a remote provider fails loudly until that step exists.
 */
const DeidentifyTrimPanel: React.FC<Props> = ({
  sourceUri,
  providers,
  onDone,
  onRun,
}) => {
  const { t } = useTranslation();
  const { colorScheme } = useThemeContext();
  const palette = getPalette(colorScheme);
  const [provider, setProvider] = useState(providers[0]);
  const [duration, setDuration] = useState(0);
  const [videoSize, setVideoSize] = useState<Size | null>(null);
  const [viewSize, setViewSize] = useState<Size>({ width: 0, height: 0 });
  const [trim, setTrim] = useState<TrimWindow>({ start: 0, end: 0 });
  const [taps, setTaps] = useState<Point[]>([]);
  const [playhead, setPlayhead] = useState(0);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const needsTaps = (provider?.promptCount ?? 0) > 0;
  const limitsFor = (p: DeidentifyProvider): TrimLimits => ({
    duration,
    min: p.minSeconds,
    max: p.maxSeconds,
  });
  const limits = provider ? limitsFor(provider) : undefined;

  const player = useVideoPlayer(sourceUri, (p) => {
    p.muted = true;
    p.timeUpdateEventInterval = 0.25;
  });

  useEventListener(player, "sourceLoad", (e) => {
    setDuration(e.duration);
    const size = e.availableVideoTracks[0]?.size;
    if (size && size.width > 0 && size.height > 0) setVideoSize(size);
    if (provider) {
      setTrim(
        initialWindow({
          duration: e.duration,
          min: provider.minSeconds,
          max: provider.maxSeconds,
        }),
      );
    }
    if (!needsTaps) player.play();
  });

  // Loop inside the window rather than over the whole clip. A tracking provider holds the
  // first frame still instead, for the taps.
  useEventListener(player, "timeUpdate", ({ currentTime }) => {
    setPlayhead(currentTime);
    if (needsTaps || trim.end <= trim.start) return;
    if (currentTime >= trim.end || currentTime < trim.start - 0.5) {
      player.seekBy(trim.start - currentTime);
    }
  });

  // seekBy rather than assigning currentTime: the React Compiler treats the player returned
  // by a hook as immutable, and a method call is not a mutation to it.
  const seekToWindow = (w: TrimWindow) => {
    player.seekBy(w.start - player.currentTime);
  };

  const windowChanged = (w: TrimWindow) => {
    seekToWindow(w);
    setTaps([]); // the first frame moved, so the old taps point at nothing
  };

  const chooseProvider = (p: DeidentifyProvider) => {
    setProvider(p);
    setTaps([]);
    const fitted = fitWindow(trim, limitsFor(p));
    setTrim(fitted);
    seekToWindow(fitted);
    if (p.promptCount > 0) player.pause();
    else player.play();
  };

  const onTap = (e: GestureResponderEvent) => {
    if (!provider || !videoSize || taps.length >= provider.promptCount) return;
    const point = tapToVideoPoint(
      { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY },
      viewSize,
      videoSize,
    );
    if (point) setTaps([...taps, point]);
  };

  const run = async () => {
    if (!provider) return;
    player.pause();
    if (onRun) {
      onRun(provider, {
        sourceUri,
        startSeconds: trim.start,
        endSeconds: trim.end,
        ...(needsTaps && { prompts: taps }),
      });
      return;
    }
    setError(null);
    setProgress(0);
    try {
      const outcome = await runDeidentify(
        provider,
        {
          sourceUri,
          startSeconds: trim.start,
          endSeconds: trim.end,
          ...(needsTaps && { prompts: taps }),
        },
        ({ fraction }) => setProgress(fraction),
      );
      onDone?.(outcome);
    } catch (e) {
      setError(
        t("deidentifyFailed", {
          message: e instanceof Error ? e.message : String(e),
        }),
      );
    } finally {
      setProgress(null);
    }
  };

  const styles = getStyles(palette);
  const text = { color: palette[PaletteColor.PrimaryText] };
  /** The app's button: primary, secondary (border colour) or a selected choice. */
  const button = (
    label: string,
    onPress: () => void,
    {
      primary = false,
      disabled = false,
    }: { primary?: boolean; disabled?: boolean } = {},
  ) => (
    <TouchableOpacity
      key={label}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={[
        primary ? styles.buttonPrimary : styles.buttonSecondary,
        disabled && styles.disabled,
      ]}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </TouchableOpacity>
  );
  if (!provider || !limits) {
    return <Text style={text}>{t("deidentifyNoProvider")}</Text>;
  }
  const loaded = duration > 0;
  const trimmable = loaded && canTrim(limits);
  const tapsDone = !needsTaps || taps.length === provider.promptCount;
  const tapHint = t("deidentifyTapDancers", {
    count: taps.length,
    total: provider.promptCount,
  });

  return (
    <View style={styles.panel}>
      <View
        style={[
          styles.preview,
          videoSize && { aspectRatio: videoSize.width / videoSize.height },
        ]}
        onLayout={(e: LayoutChangeEvent) => setViewSize(e.nativeEvent.layout)}
      >
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          nativeControls={false}
          contentFit="contain"
        />
        {needsTaps && (
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onTap}
            accessibilityRole="button"
            accessibilityLabel={tapHint}
            testID="prompt-overlay"
          >
            {videoSize &&
              taps.map((p, i) => {
                const at = videoPointToView(p, viewSize, videoSize);
                return (
                  <View
                    key={i}
                    pointerEvents="none"
                    style={[
                      styles.marker,
                      {
                        left: at.x - MARKER / 2,
                        top: at.y - MARKER / 2,
                        backgroundColor:
                          DANCER_COLOURS[i % DANCER_COLOURS.length],
                      },
                    ]}
                  >
                    <Text style={styles.markerText}>{i + 1}</Text>
                  </View>
                );
              })}
          </Pressable>
        )}
      </View>
      {loaded && !trimmable && (
        <Text style={{ color: palette[PaletteColor.Error] }}>
          {t("deidentifyTooShort", { min: provider.minSeconds })}
        </Text>
      )}
      {trimmable && (
        <TrimWindowBar
          limits={limits}
          window={trim}
          onChange={setTrim}
          onChangeEnd={windowChanged}
          playhead={needsTaps ? undefined : playhead}
        />
      )}
      {needsTaps && trimmable && (
        <View style={styles.row}>
          <Text style={[text, styles.hint]}>{tapHint}</Text>
          {taps.length > 0 &&
            button(t("deidentifyResetTaps"), () => setTaps([]))}
        </View>
      )}
      {providers.length > 1 && (
        <View style={styles.row}>
          {providers.map((p) => (
            <TouchableOpacity
              key={p.id}
              onPress={() => chooseProvider(p)}
              disabled={p.id === provider.id || progress !== null}
              accessibilityRole="button"
              accessibilityState={{ selected: p.id === provider.id }}
              style={[
                styles.choice,
                p.id === provider.id && styles.choiceSelected,
              ]}
            >
              <Text
                style={[
                  styles.choiceText,
                  p.id === provider.id && styles.choiceTextSelected,
                ]}
              >
                {t(p.labelKey)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      {progress === null ? (
        button(t("deidentifyRun"), run, {
          primary: true,
          disabled: !trimmable || !tapsDone,
        })
      ) : (
        <Text style={text}>
          {t("deidentifyProgress", { percent: Math.round(progress * 100) })}
        </Text>
      )}
      {error && (
        <Text style={{ color: palette[PaletteColor.Error] }}>{error}</Text>
      )}
    </View>
  );
};

const getStyles = (palette: Record<PaletteColor, string>) =>
  StyleSheet.create({
    buttonPrimary: { ...getCommonButton(palette), alignItems: "center" },
    buttonSecondary: {
      ...getCommonButton(palette, palette[PaletteColor.Border]),
      alignItems: "center",
    },
    buttonText: {
      color: palette[PaletteColor.PrimaryText],
      fontWeight: "bold",
    },
    disabled: { opacity: 0.5 },
    choice: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: palette[PaletteColor.Border],
      backgroundColor: palette[PaletteColor.Surface],
    },
    choiceSelected: {
      borderColor: palette[PaletteColor.Primary],
      backgroundColor: palette[PaletteColor.TagBg],
    },
    choiceText: { color: palette[PaletteColor.PrimaryText] },
    choiceTextSelected: {
      color: palette[PaletteColor.Primary],
      fontWeight: "bold",
    },
    panel: { gap: 12 },
    preview: {
      width: "100%",
      aspectRatio: 16 / 9,
      maxHeight: 420,
      backgroundColor: "#000",
    },
    row: { ...getCommonRow(), gap: 8, flexWrap: "wrap" },
    hint: { flex: 1 },
    marker: {
      position: "absolute",
      width: MARKER,
      height: MARKER,
      borderRadius: MARKER / 2,
      borderWidth: 2,
      borderColor: "#fff",
      alignItems: "center",
      justifyContent: "center",
    },
    markerText: { color: "#000", fontWeight: "bold" },
  });

export default DeidentifyTrimPanel;
