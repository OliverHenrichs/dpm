import React, { useState } from "react";
import {
  GestureResponderEvent,
  LayoutChangeEvent,
  Pressable,
  Text,
  View,
} from "react-native";
import { Button, Chip } from "@/src/common/ui";
import { StyleSheet } from "react-native-unistyles";
import { useEventListener } from "expo";
import { useVideoPlayer, VideoView } from "expo-video";
import { useTranslation } from "react-i18next";
import { getCommonRow } from "@/src/common/utils/CommonStyles";
import TrimWindowBar from "@/src/anonymize/components/TrimWindowBar";
import {
  Point,
  Size,
  tapToVideoPoint,
  videoPointToView,
} from "@/src/anonymize/model/promptPoints";
import { TrimLimits, TrimWindow } from "@/src/anonymize/model/trimWindow";
import {
  AnonymizeProvider,
  AnonymizeRequest,
} from "@/src/anonymize/providers/AnonymizeProvider";
import { TrimRequest } from "@/src/anonymize/shortenVideo";

type Props = {
  sourceUri: string;
  /**
   * Providers that can anonymize here (`availableProviders`); empty when the video is
   * already anonymized, which leaves shortening only.
   */
  providers: AnonymizeProvider[];
  onShorten: (request: TrimRequest) => void;
  onAnonymize: (provider: AnonymizeProvider, request: AnonymizeRequest) => void;
  /** Shown above the actions while picking the part to keep (an option that goes with them). */
  options?: React.ReactNode;
};

/** The output palette's dancer colours, so a marker shows which colour that dancer gets. */
// Output data, not UI: they must match what the anonymize pipeline paints.
// eslint-disable-next-line no-restricted-syntax
const DANCER_COLOURS = ["#F59E0B", "#14B8A6"];
const MARKER = 28;
/** Shortest selection worth cutting, in seconds. */
const MIN_SECONDS = 1;
/** A window this close to both ends of the clip is the whole clip — nothing to shorten. */
const WHOLE_CLIP_SLACK = 0.1;

/**
 * Edit a pattern's video: pick the part to keep on a bar over the whole clip, then either
 * shorten the video to it or anonymize it (the user-facing word for anonymizing). The preview loops the selection, so what you see
 * is what you keep. Anonymizing is offered once the selection fits the provider (30 s
 * on-device); a provider that tracks from a prompt then holds the selection's first frame for
 * one tap per dancer.
 *
 * Both actions only hand the request over; the caller runs it as a background job.
 *
 * Remote providers are not offered a consent step yet — `runAnonymize` refuses them without
 * one, so adding a remote provider fails loudly until that step exists.
 */
const VideoEditPanel: React.FC<Props> = ({
  sourceUri,
  providers,
  onShorten,
  onAnonymize,
  options,
}) => {
  const { t } = useTranslation();
  const [provider, setProvider] = useState<AnonymizeProvider | undefined>(
    providers[0],
  );
  const [step, setStep] = useState<"trim" | "prompt">("trim");
  const [duration, setDuration] = useState(0);
  const [videoSize, setVideoSize] = useState<Size | null>(null);
  const [viewSize, setViewSize] = useState<Size>({ width: 0, height: 0 });
  const [trim, setTrim] = useState<TrimWindow>({ start: 0, end: 0 });
  const [taps, setTaps] = useState<Point[]>([]);
  // How many dancers to tap, for a provider that can follow fewer than a couple.
  const [dancers, setDancers] = useState(providers[0]?.promptCount ?? 0);
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
  const tapsDone = !needsTaps || taps.length === dancers;
  const fewestDancers = provider?.minPromptCount ?? provider?.promptCount ?? 0;
  const request = (): AnonymizeRequest => ({
    sourceUri,
    startSeconds: trim.start,
    endSeconds: trim.end,
    ...(needsTaps && { prompts: taps }),
  });

  const anonymize = () => {
    if (!provider) return;
    if (!needsTaps) {
      player.pause();
      onAnonymize(provider, request());
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
    if (!provider || !videoSize || taps.length >= dancers) return;
    const point = tapToVideoPoint(
      { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY },
      viewSize,
      videoSize,
    );
    if (point) setTaps([...taps, point]);
  };
  const button = (
    label: string,
    onPress: () => void,
    {
      primary = false,
      disabled = false,
    }: { primary?: boolean; disabled?: boolean } = {},
  ) => (
    <Button
      key={label}
      title={label}
      variant={primary ? "primary" : "secondary"}
      onPress={onPress}
      disabled={disabled}
      style={styles.button}
    />
  );
  const tapHint = t("anonymizeTapDancers", {
    count: taps.length,
    total: dancers,
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
          {isWholeClip && (
            <Text style={styles.hint}>{t("videoShortenHint")}</Text>
          )}
          {provider && !fitsProvider && (
            <Text style={styles.hint}>
              {length < provider.minSeconds
                ? t("anonymizeTooShort", { min: provider.minSeconds })
                : t("anonymizeTooLong", { max: provider.maxSeconds })}
            </Text>
          )}
          {options}
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
              button(t("anonymizeRun"), anonymize, {
                primary: true,
                disabled: !fitsProvider,
              })}
          </View>
          {provider && <Text style={styles.hint}>{t("anonymizeWhy")}</Text>}
        </>
      )}

      {prompting && provider && (
        <>
          <Text style={styles.text}>{tapHint}</Text>
          <Text style={styles.hint}>{t("anonymizeTapFrameHint")}</Text>
          {providers.length > 1 && (
            <View style={styles.row}>
              {providers.map((p) => {
                const selected = p.id === provider.id;
                return (
                  <Chip
                    key={p.id}
                    label={t(p.labelKey)}
                    selected={selected}
                    onPress={() => {
                      setProvider(p);
                      setDancers(p.promptCount);
                      setTaps([]);
                    }}
                  />
                );
              })}
            </View>
          )}
          {fewestDancers < provider.promptCount && (
            <View style={styles.row}>
              {/* Labels exist for one and two: the most any provider follows today. */}
              {[1, 2]
                .filter((n) => n >= fewestDancers && n <= provider.promptCount)
                .map((n) => {
                  const selected = n === dancers;
                  return (
                    <Chip
                      key={n}
                      label={
                        n === 1 ? t("anonymizeOneDancer") : t("anonymizeCouple")
                      }
                      selected={selected}
                      onPress={() => {
                        setDancers(n);
                        setTaps([]);
                      }}
                    />
                  );
                })}
            </View>
          )}
          <View style={styles.row}>
            {button(t("back"), backToTrim)}
            {taps.length > 0 &&
              button(t("anonymizeResetTaps"), () => setTaps([]))}
            {button(
              t("anonymizeStart"),
              () => onAnonymize(provider, request()),
              { primary: true, disabled: !tapsDone },
            )}
          </View>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
  panel: { gap: theme.space.md },
  preview: {
    width: "100%",
    aspectRatio: 16 / 9,
    maxHeight: 420,
    backgroundColor: theme.media.black,
  },
  row: { ...getCommonRow(), gap: theme.space.sm, flexWrap: "wrap" },
  text: { ...theme.typography.body, color: theme.colors.text },
  hint: { ...theme.typography.bodySmall, color: theme.colors.textMuted },
  button: { flexGrow: 1, alignItems: "center" },
  marker: {
    position: "absolute",
    width: MARKER,
    height: MARKER,
    borderRadius: MARKER / 2,
    borderWidth: 2,
    borderColor: theme.media.onScrim,
    alignItems: "center",
    justifyContent: "center",
  },
  markerText: {
    ...theme.typography.label,
    color: theme.media.black,
    fontWeight: "bold",
  },
}));

export default VideoEditPanel;
