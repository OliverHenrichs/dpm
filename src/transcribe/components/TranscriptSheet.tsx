import React, { useEffect, useRef, useState } from "react";
import { Modal, ScrollView, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import { useEventListener } from "expo";
import { useVideoPlayer, VideoView } from "expo-video";
import { capVideoBuffer } from "@/src/common/utils/videoBuffer";
import ModalOverlay from "@/src/common/components/ModalOverlay";
import {
  AppText,
  Button,
  Chip,
  Icon,
  IconButton,
  Tappable,
} from "@/src/common/ui";
import { SCREEN_EDGE_INSET } from "@/src/common/utils/EdgeInsets";
import { formatTime } from "@/src/common/utils/TImeUtils";
import { IVideoTranscript } from "@/src/pattern/types/IPatternList";
import { correctTranscriptLine } from "@/src/pattern/data/transcripts";
import { LANGUAGES } from "@/src/settings/types/Languages";
import SuggestionPanel from "@/src/suggest/components/SuggestionPanel";
import { Suggestion } from "@/src/suggest/suggestPrompt";
import {
  appendToDescription,
  segmentAt,
  transcriptExcerpt,
} from "@/src/transcribe/excerpt";
import {
  followScrollTarget,
  MANUAL_SCROLL_PAUSE_MS,
} from "@/src/transcribe/followScroll";
import TranscriptLineEditor from "@/src/transcribe/components/TranscriptLineEditor";

export type TranscriptTarget = {
  /** The list the video is in; needed only to suggest, so a read-only view may leave it out. */
  listId?: string;
  patternName: string;
  sourceUri: string;
  transcript: IVideoTranscript;
  /** A silhouette carries the transcript of its source, but has no sound to transcribe again. */
  hasSound: boolean;
};

type Props = {
  /** The video whose transcript to show; null hides the sheet. */
  target: TranscriptTarget | null;
  onClose: () => void;
  /**
   * Appends to the open form's description; omitted where there is no form. The sheet hands
   * over the whole new description, so the caller does not need to know how it was joined.
   */
  onDescriptionChange?: (append: (description: string) => string) => void;
  /** Transcribes the video again in a given language, when detection got it wrong. */
  onRetranscribe?: (language: string) => void;
  /** Takes a suggested name and description (L4); omitted where there is no form to fill. */
  onApplySuggestion?: (suggestion: Suggestion) => void;
  /**
   * Takes the transcript with a line corrected by hand; the caller keeps it and hands it back in
   * [target]. Omitted where the transcript cannot be changed (the read-only pattern details).
   */
  onTranscriptChange?: (transcript: IVideoTranscript) => void;
};

/** Whisper's name for a language the app does not ship, or "und" when nothing was said. */
const languageLabel = (code: string, unknown: string) =>
  code === "und"
    ? unknown
    : (LANGUAGES.find((l) => l.code === code)?.label ?? code.toUpperCase());

/**
 * What was said in a video (L4): the video on top, the transcript below as timestamped lines.
 * Tapping a line plays the video from there. In a form, ticking lines and pressing "Copy … to
 * description" appends them word for word to the open form's description, and the suggestion
 * panel offers a name and description an on-device model writes in its own words; each says
 * which it is, since both end in the description. The description is never written on its own:
 * teachers count out loud and joke, and the description is the user's.
 *
 * In a form, each line's pencil corrects what the model misheard (dance slang, mostly) before
 * it is copied or suggested from. Without the form's callbacks (the read-only pattern details)
 * it is only the video and its lines, to follow along or jump to a moment.
 */
const TranscriptSheet: React.FC<Props> = ({
  target,
  onClose,
  onDescriptionChange,
  onRetranscribe,
  onApplySuggestion,
  onTranscriptChange,
}) => (
  <Modal
    visible={target !== null}
    animationType="slide"
    transparent
    onRequestClose={onClose}
  >
    <ModalOverlay align="bottom" padding="none">
      {target && (
        <TranscriptContent
          key={target.sourceUri}
          target={target}
          onClose={onClose}
          onDescriptionChange={onDescriptionChange}
          onRetranscribe={onRetranscribe}
          onApplySuggestion={onApplySuggestion}
          onTranscriptChange={onTranscriptChange}
        />
      )}
    </ModalOverlay>
  </Modal>
);

const TranscriptContent: React.FC<Props & { target: TranscriptTarget }> = ({
  target,
  onClose,
  onDescriptionChange,
  onRetranscribe,
  onApplySuggestion,
  onTranscriptChange,
}) => {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const { segments, language } = target.transcript;
  const [ticked, setTicked] = useState<ReadonlySet<number>>(new Set());
  const [playhead, setPlayhead] = useState(0);
  const [pickLanguage, setPickLanguage] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);

  const player = useVideoPlayer(target.sourceUri, (p) => {
    capVideoBuffer(p);
    p.timeUpdateEventInterval = 0.25;
  });
  useEventListener(player, "timeUpdate", ({ currentTime }) =>
    setPlayhead(currentTime),
  );
  const current = segmentAt(segments, playhead);

  // Keep the line being said in view, unless the user scrolled the transcript a moment ago:
  // following playback then would pull the text out from under their finger.
  const scrollRef = useRef<ScrollView>(null);
  const lineLayout = useRef(new Map<number, { y: number; height: number }>());
  const viewport = useRef({ y: 0, height: 0, contentHeight: 0 });
  const manualUntil = useRef(0);
  useEffect(() => {
    // Nor while a line is being corrected: it would scroll the text field away.
    if (current < 0 || editing !== null || Date.now() < manualUntil.current) {
      return;
    }
    const line = lineLayout.current.get(current);
    if (!line) return;
    const { contentHeight, ...view } = viewport.current;
    const y = followScrollTarget(line, view, contentHeight);
    if (y !== null) scrollRef.current?.scrollTo({ y, animated: true });
  }, [current, editing]);
  const pauseFollowing = () => {
    manualUntil.current = Date.now() + MANUAL_SCROLL_PAUSE_MS;
  };

  // seekBy rather than assigning currentTime: the React Compiler treats the player returned
  // by a hook as immutable, and a method call is not a mutation to it.
  const playFrom = (seconds: number) => {
    player.seekBy(seconds - player.currentTime);
    player.play();
  };
  const toggle = (i: number) => {
    const next = new Set(ticked);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    setTicked(next);
  };
  const correctLine = (index: number, text: string) => {
    const corrected = correctTranscriptLine(target.transcript, index, text);
    // A removed line shifts the ones after it; the ticks would land on their neighbours.
    if (corrected.segments.length !== segments.length) setTicked(new Set());
    onTranscriptChange?.(corrected);
    setEditing(null);
  };
  const addToDescription = () => {
    const excerpt = transcriptExcerpt(segments, ticked);
    onDescriptionChange?.((description) =>
      appendToDescription(description, excerpt),
    );
    onClose();
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <AppText variant="title" numberOfLines={1} style={styles.title}>
          {`${t("transcriptTitle")} — ${target.patternName}`}
        </AppText>
        <IconButton
          icon="close"
          color="textMuted"
          onPress={onClose}
          accessibilityLabel={t("close")}
        />
      </View>

      <View style={styles.preview}>
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          nativeControls
          contentFit="contain"
        />
      </View>

      <View style={styles.languageRow}>
        <AppText variant="bodySmall" color="textMuted" style={styles.flex}>
          {t("transcriptLanguage", {
            language: languageLabel(language, t("transcriptLanguageUnknown")),
          })}
        </AppText>
        {onRetranscribe && target.hasSound && (
          <Button
            title={t("transcriptWrongLanguage")}
            variant="ghost"
            size="sm"
            onPress={() => setPickLanguage(!pickLanguage)}
          />
        )}
      </View>
      {pickLanguage && onRetranscribe && (
        <View style={styles.chips}>
          {LANGUAGES.filter((l) => l.code !== language).map((l) => (
            <Chip
              key={l.code}
              label={l.label}
              onPress={() => {
                onRetranscribe(l.code);
                onClose();
              }}
            />
          ))}
        </View>
      )}

      {onApplySuggestion && target.listId && (
        <SuggestionPanel
          listId={target.listId}
          patternName={target.patternName}
          sourceUri={target.sourceUri}
          transcript={target.transcript}
          onApply={(suggestion) => {
            onApplySuggestion(suggestion);
            onClose();
          }}
        />
      )}

      {onDescriptionChange && segments.length > 0 && (
        <AppText variant="caption" color="textMuted">
          {t("transcriptCopyHint")}
        </AppText>
      )}
      <ScrollView
        ref={scrollRef}
        style={styles.lines}
        contentContainerStyle={styles.linesContent}
        scrollEventThrottle={100}
        onScroll={(e) => {
          viewport.current.y = e.nativeEvent.contentOffset.y;
        }}
        onLayout={(e) => {
          viewport.current.height = e.nativeEvent.layout.height;
        }}
        onContentSizeChange={(_, height) => {
          viewport.current.contentHeight = height;
        }}
        onScrollBeginDrag={pauseFollowing}
        onScrollEndDrag={pauseFollowing}
        onMomentumScrollEnd={pauseFollowing}
      >
        {segments.length === 0 && (
          <AppText color="textMuted">{t("transcriptEmpty")}</AppText>
        )}
        {segments.map((segment, i) => {
          const isTicked = ticked.has(i);
          if (i === editing && onTranscriptChange) {
            return (
              <TranscriptLineEditor
                key={i}
                segment={segment}
                onSave={(text) => correctLine(i, text)}
                onCancel={() => setEditing(null)}
              />
            );
          }
          return (
            <View
              key={i}
              style={[styles.line, i === current && styles.currentLine]}
              onLayout={(e) => {
                const { y, height } = e.nativeEvent.layout;
                lineLayout.current.set(i, { y, height });
              }}
            >
              {onDescriptionChange && (
                <IconButton
                  icon={isTicked ? "checkbox-marked" : "checkbox-blank-outline"}
                  color={isTicked ? "primary" : "textMuted"}
                  onPress={() => toggle(i)}
                  accessibilityLabel={t("transcriptTickLine", {
                    time: formatTime(segment.start),
                  })}
                  selected={isTicked}
                />
              )}
              <Tappable
                onPress={() => playFrom(segment.start)}
                accessibilityLabel={t("transcriptPlayFrom", {
                  time: formatTime(segment.start),
                })}
                style={styles.lineText}
              >
                <View style={styles.timeRow}>
                  <Icon
                    name="play-circle-outline"
                    size={theme.iconSize.sm}
                    color={theme.colors.textMuted}
                  />
                  <AppText variant="caption" color="textMuted">
                    {formatTime(segment.start)}
                  </AppText>
                </View>
                <AppText>{segment.text}</AppText>
              </Tappable>
              {onTranscriptChange && (
                <IconButton
                  icon="pencil-outline"
                  color="textMuted"
                  onPress={() => setEditing(i)}
                  accessibilityLabel={t("transcriptLineEdit", {
                    time: formatTime(segment.start),
                  })}
                />
              )}
            </View>
          );
        })}
      </ScrollView>

      {onDescriptionChange && segments.length > 0 && (
        <Button
          title={t("transcriptAddToDescription", { count: ticked.size })}
          icon="content-copy"
          onPress={addToDescription}
          disabled={ticked.size === 0}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create((theme, rt) => ({
  card: {
    maxHeight: "92%",
    gap: theme.space.sm,
    padding: theme.space.lg,
    paddingHorizontal: SCREEN_EDGE_INSET + theme.space.lg,
    paddingBottom: theme.space.lg + rt.insets.bottom,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    backgroundColor: theme.colors.background,
  },
  header: { flexDirection: "row", alignItems: "center", gap: theme.space.sm },
  title: { flex: 1 },
  flex: { flex: 1 },
  preview: {
    width: "100%",
    aspectRatio: 16 / 9,
    maxHeight: 260,
    backgroundColor: theme.media.black,
  },
  languageRow: { flexDirection: "row", alignItems: "center" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: theme.space.sm },
  lines: { flexShrink: 1 },
  linesContent: { gap: theme.space.xs },
  line: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: theme.radius.md,
  },
  currentLine: { backgroundColor: theme.colors.surfaceVariant },
  lineText: { flex: 1, padding: theme.space.sm, gap: theme.space.xxs },
  timeRow: { flexDirection: "row", alignItems: "center", gap: theme.space.xs },
}));

export default TranscriptSheet;
