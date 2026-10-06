import React, { useState } from "react";
import { View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import { AppText, Icon, IconButton, Tappable } from "@/src/common/ui";
import { formatTime } from "@/src/common/utils/TImeUtils";
import { ITranscriptSegment } from "@/src/pattern/types/IPatternList";
import { segmentAt } from "@/src/transcribe/excerpt";
import TranscriptLineEditor from "@/src/transcribe/components/TranscriptLineEditor";

type Props = {
  segments: ITranscriptSegment[];
  /** Where the video is, in seconds: the line being said there is highlighted. */
  playhead: number;
  /** Plays the video from a line's start. */
  onPlayFrom: (seconds: number) => void;
  /**
   * Takes a line corrected by hand (empty text removes it); omitted where the transcript cannot
   * be changed, which leaves the lines without a pencil.
   */
  onCorrectLine?: (index: number, text: string) => void;
};

/**
 * A transcript's timestamped lines inside a page that already scrolls and already shows the
 * video (the Speech tab of Edit video). Tapping a line plays the video from there. Copying lines
 * and suggestions stay in `TranscriptSheet`, opened from the video's thumbnail. With
 * [onCorrectLine], each line has a pencil that turns it into a text field, one line at a time.
 */
const TranscriptLines: React.FC<Props> = ({
  segments,
  playhead,
  onPlayFrom,
  onCorrectLine,
}) => {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const current = segmentAt(segments, playhead);
  const [editing, setEditing] = useState<number | null>(null);

  if (segments.length === 0) {
    return <AppText color="textMuted">{t("transcriptEmpty")}</AppText>;
  }
  return (
    <View style={styles.lines}>
      {segments.map((segment, i) =>
        i === editing && onCorrectLine ? (
          <TranscriptLineEditor
            key={i}
            segment={segment}
            onSave={(text) => {
              onCorrectLine(i, text);
              setEditing(null);
            }}
            onCancel={() => setEditing(null)}
          />
        ) : (
          <View
            key={i}
            style={[styles.line, i === current && styles.currentLine]}
          >
            <Tappable
              onPress={() => onPlayFrom(segment.start)}
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
            {onCorrectLine && (
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
        ),
      )}
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
  lines: { gap: theme.space.xs },
  line: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: theme.radius.md,
    overflow: "hidden",
  },
  lineText: { flex: 1, padding: theme.space.sm, gap: theme.space.xxs },
  currentLine: { backgroundColor: theme.colors.surfaceVariant },
  timeRow: { flexDirection: "row", alignItems: "center", gap: theme.space.xs },
}));

export default TranscriptLines;
