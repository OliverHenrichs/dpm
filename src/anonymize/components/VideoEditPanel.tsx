import React, { useState } from "react";
import {
  GestureResponderEvent,
  LayoutChangeEvent,
  Pressable,
  Text,
  View,
} from "react-native";
import {
  AppText,
  Button,
  Chip,
  Segment,
  SegmentedControl,
} from "@/src/common/ui";
import { StyleSheet } from "react-native-unistyles";
import { useEventListener } from "expo";
import { useVideoPlayer, VideoView } from "expo-video";
import { capVideoBuffer } from "@/src/common/utils/videoBuffer";
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

/** The jobs the sheet offers, one tab each. */
export type VideoEditTab = "shorten" | "anonymize" | "speech";
/** The two that cut the video, on the part picked on the trim bar. */
export type VideoCut = Exclude<VideoEditTab, "speech">;

type Props = {
  sourceUri: string;
  /**
   * Providers that can anonymize here (`availableProviders`); empty when the video is
   * already anonymized, which leaves shortening only.
   */
  providers: AnonymizeProvider[];
  onShorten: (request: TrimRequest) => void;
  onAnonymize: (provider: AnonymizeProvider, request: AnonymizeRequest) => void;
  /** Options that change a cut, shown above its button (`SwitchRow`s). */
  cutOptions?: (cut: VideoCut) => React.ReactNode;
  /** The Speech tab's content; the tab is left out without it. */
  speech?: React.ReactNode;
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
 * Edit a pattern's video, one job per tab: *Shorten*, *Anonymize* (the user-facing word for
 * turning the dancers into silhouettes) and *Speech* (the caller's content). Each tab says what
 * it does, shows the options that change it, and ends in one button naming the result. Options
 * are switches above that button, never chips or buttons of their own.
 *
 * The two cuts work on the part picked on a bar over the whole clip; the preview loops it, so
 * what you see is what you keep. Anonymizing is offered once the selection fits the provider
 * (30 s on-device); a provider that tracks from a prompt then holds the selection's first frame
 * for one tap per dancer.
 *
 * Both cuts only hand the request over; the caller runs it as a background job.
 *
 * Remote providers are not offered a consent step yet — `runAnonymize` refuses them without
 * one, so adding a remote provider fails loudly until that step exists.
 */
const VideoEditPanel: React.FC<Props> = ({
  sourceUri,
  providers,
  onShorten,
  onAnonymize,
  cutOptions,
  speech,
}) => {
  const { t } = useTranslation();
  const [provider, setProvider] = useState<AnonymizeProvider | undefined>(
    providers[0],
  );
  const [tab, setTab] = useState<VideoEditTab>("shorten");
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
  // Speech covers the whole video, so its tab plays all of it.
  const loopSelection = tab !== "speech";

  const player = useVideoPlayer(sourceUri, (p) => {
    capVideoBuffer(p);
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
    if (prompting || !loopSelection || trim.end <= trim.start) return;
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
  const seconds = Math.round(length);
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

  const tabs: Segment<VideoEditTab>[] = [
    { value: "shorten", label: t("videoShorten") },
    ...(provider
      ? [{ value: "anonymize" as const, label: t("anonymizeRun") }]
      : []),
    ...(speech
      ? [{ value: "speech" as const, label: t("transcribeSection") }]
      : []),
  ];

  const anonymize = () => {
    if (!provider) return;
    player.pause();
    if (!needsTaps) {
      onAnonymize(provider, request());
      return;
    }
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
  const tapHint = t("anonymizeTapDancers", {
    count: taps.length,
    total: dancers,
  });

  const partToKeep = (meta: string) => (
    <>
      <View style={styles.labelRow}>
        <AppText variant="label">{t("videoPartToKeep")}</AppText>
        <AppText variant="micro" color="textMuted">
          {meta}
        </AppText>
      </View>
      <TrimWindowBar
        limits={limits}
        window={trim}
        onChange={setTrim}
        onChangeEnd={(w) => seekTo(w.start)}
        playhead={playhead}
      />
    </>
  );
  /** The one button a tab ends in, with the reason under it when it cannot be pressed. */
  const action = (
    title: string,
    onPress: () => void,
    disabled = false,
    reason?: string,
  ) => (
    <View style={styles.action}>
      <Button title={title} onPress={onPress} disabled={disabled} />
      {reason ? (
        <AppText variant="caption" color="textMuted" style={styles.centred}>
          {reason}
        </AppText>
      ) : null}
    </View>
  );

  const shortenTab = (
    <>
      <AppText variant="bodySmall">{t("videoShortenWhat")}</AppText>
      {loaded && (
        <>
          {partToKeep(t("videoSeconds", { seconds }))}
          {cutOptions?.("shorten")}
          {action(
            isWholeClip ? t("videoShorten") : t("videoShortenTo", { seconds }),
            () => {
              player.pause();
              onShorten({
                sourceUri,
                startSeconds: trim.start,
                endSeconds: trim.end,
              });
            },
            isWholeClip,
            isWholeClip ? t("videoShortenHint") : undefined,
          )}
        </>
      )}
    </>
  );

  const anonymizeTab = provider && (
    <>
      <AppText variant="bodySmall">{t("anonymizeWhy")}</AppText>
      {loaded && (
        <>
          {partToKeep(
            t("videoSecondsOfMax", { seconds, max: provider.maxSeconds }),
          )}
          {cutOptions?.("anonymize")}
          {action(
            needsTaps ? t("anonymizeNext") : t("anonymizeSeconds", { seconds }),
            anonymize,
            !fitsProvider,
            fitsProvider
              ? undefined
              : length < provider.minSeconds
                ? t("anonymizeTooShort", { min: provider.minSeconds })
                : t("anonymizeTooLong", { max: provider.maxSeconds }),
          )}
        </>
      )}
    </>
  );

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

      {!prompting && (
        <>
          {tabs.length > 1 && (
            <SegmentedControl
              segments={tabs}
              value={tab}
              onChange={setTab}
              accessibilityLabel={t("videoEditTitle")}
            />
          )}
          {tab === "shorten" && shortenTab}
          {tab === "anonymize" && anonymizeTab}
          {tab === "speech" && speech}
        </>
      )}

      {prompting && provider && (
        <>
          <View style={styles.labelRow}>
            <Button
              title={t("back")}
              icon="chevron-left"
              variant="ghost"
              size="sm"
              onPress={backToTrim}
            />
            {taps.length > 0 && (
              <Button
                title={t("anonymizeResetTaps")}
                variant="ghost"
                size="sm"
                onPress={() => setTaps([])}
              />
            )}
          </View>
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
            <>
              <AppText variant="label">{t("anonymizeWhoToHide")}</AppText>
              {/* Labels exist for one and two: the most any provider follows today. */}
              <SegmentedControl
                kind="choice"
                accessibilityLabel={t("anonymizeWhoToHide")}
                segments={[1, 2]
                  .filter(
                    (n) => n >= fewestDancers && n <= provider.promptCount,
                  )
                  .map((n) => ({
                    value: String(n),
                    label:
                      n === 1 ? t("anonymizeOneDancer") : t("anonymizeCouple"),
                  }))}
                value={String(dancers)}
                onChange={(n) => {
                  setDancers(Number(n));
                  setTaps([]);
                }}
              />
            </>
          )}
          <AppText variant="bodySmall">{tapHint}</AppText>
          <AppText variant="caption" color="textMuted">
            {t("anonymizeTapFrameHint")}
          </AppText>
          {action(
            t("anonymizeSeconds", { seconds }),
            () => onAnonymize(provider, request()),
            !tapsDone,
          )}
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
  labelRow: {
    ...getCommonRow(),
    justifyContent: "space-between",
    gap: theme.space.sm,
  },
  action: { gap: theme.space.xs, marginTop: theme.space.xs },
  centred: { textAlign: "center" },
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
