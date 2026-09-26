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
import { TrimLimits, TrimWindow } from "@/src/deidentify/model/trimWindow";
import {
  DeidentifyProvider,
  DeidentifyRequest,
} from "@/src/deidentify/providers/DeidentifyProvider";
import { TrimRequest } from "@/src/deidentify/shortenVideo";

type Props = {
  sourceUri: string;
  /**
   * Providers that can de-identify here (`availableProviders`); empty when the video is
   * already de-identified, which leaves shortening only.
   */
  providers: DeidentifyProvider[];
  onShorten: (request: TrimRequest) => void;
  onDeidentify: (
    provider: DeidentifyProvider,
    request: DeidentifyRequest,
  ) => void;
};

/** The output palette's dancer colours, so a marker shows which colour that dancer gets. */
const DANCER_COLOURS = ["#F59E0B", "#14B8A6"];
const MARKER = 28;
/** Shortest selection worth cutting, in seconds. */
const MIN_SECONDS = 1;
/** A window this close to both ends of the clip is the whole clip — nothing to shorten. */
const WHOLE_CLIP_SLACK = 0.1;

/**
 * Edit a pattern's video: pick the part to keep on a bar over the whole clip, then either
 * shorten the video to it or de-identify it. The preview loops the selection, so what you see
 * is what you keep. De-identifying is offered once the selection fits the provider (30 s
 * on-device); a provider that tracks from a prompt then holds the selection's first frame for
 * one tap per dancer.
 *
 * Both actions only hand the request over; the caller runs it as a background job.
 *
 * Remote providers are not offered a consent step yet — `runDeidentify` refuses them without
 * one, so adding a remote provider fails loudly until that step exists.
 */
const VideoEditPanel: React.FC<Props> = ({
  sourceUri,
  providers,
  onShorten,
  onDeidentify,
}) => {
  const { t } = useTranslation();
  const { colorScheme } = useThemeContext();
  const palette = getPalette(colorScheme);
  const [provider, setProvider] = useState<DeidentifyProvider | undefined>(
    providers[0],
  );
  const [step, setStep] = useState<"trim" | "prompt">("trim");
  const [duration, setDuration] = useState(0);
  const [videoSize, setVideoSize] = useState<Size | null>(null);
  const [viewSize, setViewSize] = useState<Size>({ width: 0, height: 0 });
  const [trim, setTrim] = useState<TrimWindow>({ start: 0, end: 0 });
  const [taps, setTaps] = useState<Point[]>([]);
  const [playhead, setPlayhead] = useState(0);

  const limits: TrimLimits = {
    duration,
    min: Math.min(MIN_SECONDS, duration),
    max: duration,
  };
  const prompting = step === "prompt";

  const player = useVideoPlayer(sourceUri, (p) => {
    p.muted = true;
    p.timeUpdateEventInterval = 0.25;
  });

  useEventListener(player, "sourceLoad", (e) => {
    setDuration(e.duration);
    const size = e.availableVideoTracks[0]?.size;
    if (size && size.width > 0 && size.height > 0) setVideoSize(size);
    setTrim({ start: 0, end: e.duration });
    player.play();
  });

  // Loop inside the selection rather than over the whole clip. Prompting holds the first
  // frame still instead, for the taps.
  useEventListener(player, "timeUpdate", ({ currentTime }) => {
    setPlayhead(currentTime);
    if (prompting || trim.end <= trim.start) return;
    if (currentTime >= trim.end || currentTime < trim.start - 0.5) {
      player.seekBy(trim.start - currentTime);
    }
  });

  // seekBy rather than assigning currentTime: the React Compiler treats the player returned
  // by a hook as immutable, and a method call is not a mutation to it.
  const seekTo = (seconds: number) => {
    player.seekBy(seconds - player.currentTime);
  };

  const length = trim.end - trim.start;
  const loaded = duration > 0;
  const isWholeClip =
    trim.start <= WHOLE_CLIP_SLACK && trim.end >= duration - WHOLE_CLIP_SLACK;
  const fitsProvider =
    !!provider &&
    length >= provider.minSeconds &&
    length <= provider.maxSeconds + 0.05;
  const needsTaps = (provider?.promptCount ?? 0) > 0;
  const tapsDone = !needsTaps || taps.length === provider?.promptCount;
  const request = (): DeidentifyRequest => ({
    sourceUri,
    startSeconds: trim.start,
    endSeconds: trim.end,
    ...(needsTaps && { prompts: taps }),
  });

  const deidentify = () => {
    if (!provider) return;
    if (!needsTaps) {
      player.pause();
      onDeidentify(provider, request());
      return;
    }
    player.pause();
    seekTo(trim.start);
    setTaps([]);
    setStep("prompt");
  };

  const backToTrim = () => {
    setStep("trim");
    setTaps([]);
    player.play();
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

  const styles = getStyles(palette);
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
        styles.button,
        primary ? styles.buttonPrimary : styles.buttonSecondary,
        disabled && styles.disabled,
      ]}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </TouchableOpacity>
  );
  const tapHint = t("deidentifyTapDancers", {
    count: taps.length,
    total: provider?.promptCount ?? 0,
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
        {prompting && (
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

      {!prompting && loaded && (
        <>
          <TrimWindowBar
            limits={limits}
            window={trim}
            onChange={setTrim}
            onChangeEnd={(w) => seekTo(w.start)}
            playhead={playhead}
          />
          {provider && !fitsProvider && (
            <Text style={styles.hint}>
              {length < provider.minSeconds
                ? t("deidentifyTooShort", { min: provider.minSeconds })
                : t("deidentifyTooLong", { max: provider.maxSeconds })}
            </Text>
          )}
          <View style={styles.row}>
            {button(
              t("videoShorten"),
              () => {
                player.pause();
                onShorten({
                  sourceUri,
                  startSeconds: trim.start,
                  endSeconds: trim.end,
                });
              },
              { disabled: isWholeClip },
            )}
            {provider &&
              button(t("deidentifyRun"), deidentify, {
                primary: true,
                disabled: !fitsProvider,
              })}
          </View>
        </>
      )}

      {prompting && provider && (
        <>
          <Text style={styles.text}>{tapHint}</Text>
          {providers.length > 1 && (
            <View style={styles.row}>
              {providers.map((p) => {
                const selected = p.id === provider.id;
                return (
                  <TouchableOpacity
                    key={p.id}
                    onPress={() => {
                      setProvider(p);
                      setTaps([]);
                    }}
                    disabled={selected}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    style={[styles.choice, selected && styles.choiceSelected]}
                  >
                    <Text
                      style={[
                        styles.choiceText,
                        selected && styles.choiceTextSelected,
                      ]}
                    >
                      {t(p.labelKey)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
          <View style={styles.row}>
            {button(t("back"), backToTrim)}
            {taps.length > 0 &&
              button(t("deidentifyResetTaps"), () => setTaps([]))}
            {button(
              t("deidentifyStart"),
              () => onDeidentify(provider, request()),
              { primary: true, disabled: !tapsDone },
            )}
          </View>
        </>
      )}
    </View>
  );
};

const getStyles = (palette: Record<PaletteColor, string>) =>
  StyleSheet.create({
    panel: { gap: 12 },
    preview: {
      width: "100%",
      aspectRatio: 16 / 9,
      maxHeight: 420,
      backgroundColor: "#000",
    },
    row: { ...getCommonRow(), gap: 8, flexWrap: "wrap" },
    text: { color: palette[PaletteColor.PrimaryText] },
    hint: { fontSize: 13, color: palette[PaletteColor.SecondaryText] },
    button: { flexGrow: 1, alignItems: "center" },
    buttonPrimary: getCommonButton(palette),
    buttonSecondary: getCommonButton(palette, palette[PaletteColor.Border]),
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

export default VideoEditPanel;
