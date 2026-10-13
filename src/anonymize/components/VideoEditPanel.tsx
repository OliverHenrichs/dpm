import React, { useEffect, useRef, useState } from "react";
import {
  GestureResponderEvent,
  Image,
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
import {
  AnonymizePreviewer,
  useAnonymizePreview,
} from "@/src/anonymize/components/useAnonymizePreview";
import {
  DancerOutliner,
  useDancerOutline,
} from "@/src/anonymize/components/useDancerOutline";

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
  /**
   * The Speech tab's content, given the preview's playback so a transcript can follow it and
   * jump in it; the tab is left out without it.
   */
  speech?: (playback: SpeechPlayback) => React.ReactNode;
  /**
   * Offers to render the first half second (`PREVIEW_SECONDS`) once the dancers are tapped; left out, there
   * is no preview. Only for a provider that keeps the footage on the device.
   */
  previewer?: AnonymizePreviewer;
  /**
   * After each tap, highlights who the taps picked on the frame, so a wrong pick is caught
   * before the render; left out, the frame shows the taps alone. Only for a provider that
   * outlines on the device.
   */
  outliner?: DancerOutliner;
};

/** The preview is a fraction of a second; slowed down, the eye can follow it. */
const PREVIEW_RATE = 0.5;

/** The preview's playback, as the Speech tab sees it. */
export type SpeechPlayback = {
  /** Where the preview is, in seconds. */
  playhead: number;
  /** Plays the preview from a moment, with its sound. */
  playFrom: (seconds: number) => void;
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
 * Both cuts only hand the request over; the caller runs it as a background job. Anonymizing is
 * experimental — slow on older phones, and a silhouette can lose its dancer — so the tab says
 * so, and once the dancers are tapped the first half second can be rendered and watched before
 * the full render. Changing the taps throws that preview away. Each tap also highlights, on the
 * frame, who the taps picked (the masks tracking starts from), so a tap on the wrong person or on
 * nobody is caught before the render; *Tap again* starts over.
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
  previewer,
  outliner,
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
  const {
    preview,
    render: renderPreviewOf,
    reset: resetPreview,
  } = useAnonymizePreview(previewer);
  const {
    outline,
    find: findOutline,
    reset: resetOutline,
    prepare: prepareOutline,
    release: releaseOutline,
  } = useDancerOutline(outliner);

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

  // The cuts are about the picture, so their preview is silent. Speech is about the sound.
  // Through a ref: the React Compiler will not let a hook's return value be assigned to.
  const playerRef = useRef(player);
  useEffect(() => {
    playerRef.current = player;
    playerRef.current.muted = loopSelection;
  }, [player, loopSelection]);

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

  const canPreview =
    !!previewer && !!provider && !provider.sendsFootageOffDevice;

  const renderPreview = () => {
    if (provider) renderPreviewOf(provider, request());
  };

  const canOutline =
    !!outliner && !!provider?.outline && !provider.sendsFootageOffDevice;

  /**
   * New taps, so any preview of the old ones is stale. With taps left, the frame highlights who
   * they picked: all of them, since a couple's taps decide each other's outline.
   */
  const retap = (next: Point[]) => {
    resetPreview();
    setTaps(next);
    if (provider && canOutline && next.length > 0) {
      findOutline(provider, {
        sourceUri,
        atSeconds: trim.start,
        prompts: next,
      });
    } else {
      resetOutline();
    }
  };
  const shownOutline =
    outline.status === "ready"
      ? outline.outline
      : outline.status === "finding"
        ? outline.shown
        : undefined;
  const missed = shownOutline?.found.findIndex((found) => !found) ?? -1;

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
    retap([]);
    setStep("prompt");
    // Ready before the first tap: loading the model and encoding the frame are most of the wait.
    if (canOutline) {
      prepareOutline(provider, { sourceUri, atSeconds: trim.start });
    }
  };

  const backToTrim = () => {
    setStep("trim");
    retap([]);
    releaseOutline();
    player.play();
  };

  const onTap = (e: GestureResponderEvent) => {
    if (!provider || !videoSize || taps.length >= dancers) return;
    const point = tapToVideoPoint(
      { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY },
      viewSize,
      videoSize,
    );
    if (point) retap([...taps, point]);
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
      <View style={styles.experimental}>
        <View style={styles.badge}>
          <AppText variant="badge" color="onSurfaceVariant">
            {t("anonymizeExperimental").toUpperCase()}
          </AppText>
        </View>
        <AppText variant="caption" color="textMuted" style={styles.flex}>
          {t("anonymizeExperimentalNote")}
        </AppText>
      </View>
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

  /** What the highlight on the frame says: still looking, check it, or a tap that missed. */
  const outlineNote = () => {
    if (outline.status === "idle") return null;
    const note =
      outline.status === "finding"
        ? t("anonymizeOutlineFinding")
        : outline.status === "failed"
          ? t("anonymizeOutlineFailed")
          : missed >= 0
            ? t("anonymizeOutlineMissed", { number: missed + 1 })
            : t("anonymizeOutlineCheck");
    const warn =
      outline.status === "failed" ||
      (outline.status === "ready" && missed >= 0);
    return (
      <AppText
        variant="caption"
        color={warn ? "danger" : "textMuted"}
        testID="outline-note"
      >
        {note}
      </AppText>
    );
  };

  /** Render the first half second, then watch it over the frame, or say it failed. */
  const previewSection = () => {
    if (preview.status === "ready") {
      return (
        <AppText variant="bodySmall" style={styles.centred}>
          {t("anonymizePreviewReady")}
        </AppText>
      );
    }
    const rendering = preview.status === "rendering";
    return (
      <View style={styles.action}>
        <Button
          title={
            rendering
              ? t("anonymizePreviewRendering", {
                  percent: Math.round(preview.progress * 100),
                })
              : t("anonymizePreview")
          }
          icon="eye-outline"
          variant="secondary"
          loading={rendering}
          disabled={rendering}
          onPress={renderPreview}
        />
        {preview.status === "failed" && (
          <AppText variant="caption" color="danger" style={styles.centred}>
            {t("anonymizePreviewFailed")}
          </AppText>
        )}
      </View>
    );
  };

  return (
    <View style={styles.panel}>
      <View
        style={[
          styles.preview,
          videoSize && { aspectRatio: videoSize.width / videoSize.height },
        ]}
        onLayout={(e: LayoutChangeEvent) => setViewSize(e.nativeEvent.layout)}
        testID="video-preview"
      >
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          // Pause and scrub while following a transcript; the cuts have their own bar.
          nativeControls={!loopSelection}
          contentFit="contain"
        />
        {prompting && shownOutline && (
          <Image
            source={{ uri: shownOutline.uri }}
            style={StyleSheet.absoluteFill}
            resizeMode="contain"
            accessibilityLabel={t("anonymizeOutlineCheck")}
            testID="dancer-outline"
          />
        )}
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
        {prompting && preview.status === "ready" && (
          <PreviewClip uri={preview.uri} />
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
          {tab === "speech" &&
            speech?.({
              playhead,
              playFrom: (seconds) => {
                seekTo(seconds);
                player.play();
              },
            })}
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
                onPress={() => retap([])}
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
                      retap([]);
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
                  retap([]);
                }}
              />
            </>
          )}
          <AppText variant="bodySmall">{tapHint}</AppText>
          {outlineNote()}
          <AppText variant="caption" color="textMuted">
            {t("anonymizeTapFrameHint")}
          </AppText>
          {canPreview && tapsDone && previewSection()}
          {action(
            t("anonymizeSeconds", { seconds }),
            () => {
              releaseOutline();
              onAnonymize(provider, request());
            },
            !tapsDone,
          )}
        </>
      )}
    </View>
  );
};

/** A rendered preview, looped slowly over the tap frame. */
const PreviewClip: React.FC<{ uri: string }> = ({ uri }) => {
  const { t } = useTranslation();
  const player = useVideoPlayer(uri, (p) => {
    capVideoBuffer(p);
    p.muted = true;
    p.loop = true;
    p.playbackRate = PREVIEW_RATE;
    p.play();
  });
  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      nativeControls={false}
      contentFit="contain"
      accessibilityLabel={t("anonymizePreviewReady")}
      testID="anonymize-preview"
    />
  );
};

const styles = StyleSheet.create((theme) => ({
  panel: { gap: theme.space.md },
  experimental: {
    ...getCommonRow(),
    alignItems: "flex-start",
    gap: theme.space.sm,
  },
  badge: {
    paddingHorizontal: theme.space.sm,
    paddingVertical: theme.space.xxs,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceVariant,
  },
  flex: { flex: 1 },
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
