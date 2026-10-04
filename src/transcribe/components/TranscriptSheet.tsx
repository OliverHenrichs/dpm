import React, { useState } from "react";
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
import { LANGUAGES } from "@/src/settings/types/Languages";
import SuggestionPanel from "@/src/suggest/components/SuggestionPanel";
import { Suggestion } from "@/src/suggest/suggestPrompt";
import {
  appendToDescription,
  segmentAt,
  transcriptExcerpt,
} from "@/src/transcribe/excerpt";

export type TranscriptTarget = {
  listId: string;
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
};

/** Whisper's name for a language the app does not ship, or "und" when nothing was said. */
const languageLabel = (code: string, unknown: string) =>
  code === "und"
    ? unknown
    : (LANGUAGES.find((l) => l.code === code)?.label ?? code.toUpperCase());

/**
 * What was said in a video (L4): the video on top, the transcript below as timestamped lines.
 * Tapping a line plays the video from there; ticking lines and pressing "Add to description"
 * appends them to the open form's description. The description is never written on its own —
 * teachers count out loud and joke, and the description is the user's.
 */
const TranscriptSheet: React.FC<Props> = ({
  target,
  onClose,
  onDescriptionChange,
  onRetranscribe,
  onApplySuggestion,
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
}) => {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const { segments, language } = target.transcript;
  const [ticked, setTicked] = useState<ReadonlySet<number>>(new Set());
  const [playhead, setPlayhead] = useState(0);
  const [pickLanguage, setPickLanguage] = useState(false);

  const player = useVideoPlayer(target.sourceUri, (p) => {
    capVideoBuffer(p);
    p.timeUpdateEventInterval = 0.25;
  });
  useEventListener(player, "timeUpdate", ({ currentTime }) =>
    setPlayhead(currentTime),
  );
  const current = segmentAt(segments, playhead);

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

      {onApplySuggestion && (
        <SuggestionPanel
          transcript={target.transcript}
          onApply={(suggestion) => {
            onApplySuggestion(suggestion);
            onClose();
          }}
        />
      )}

      <ScrollView
        style={styles.lines}
        contentContainerStyle={styles.linesContent}
      >
        {segments.length === 0 && (
          <AppText color="textMuted">{t("transcriptEmpty")}</AppText>
        )}
        {segments.map((segment, i) => {
          const isTicked = ticked.has(i);
          return (
            <View
              key={i}
              style={[styles.line, i === current && styles.currentLine]}
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
            </View>
          );
        })}
      </ScrollView>

      {onDescriptionChange && segments.length > 0 && (
        <Button
          title={t("transcriptAddToDescription", { count: ticked.size })}
          icon="text-box-plus-outline"
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
