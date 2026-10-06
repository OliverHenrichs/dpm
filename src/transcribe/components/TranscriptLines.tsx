import React from "react";
import { View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import { AppText, Icon, Tappable } from "@/src/common/ui";
import { formatTime } from "@/src/common/utils/TImeUtils";
import { ITranscriptSegment } from "@/src/pattern/types/IPatternList";
import { segmentAt } from "@/src/transcribe/excerpt";

type Props = {
  segments: ITranscriptSegment[];
  /** Where the video is, in seconds: the line being said there is highlighted. */
  playhead: number;
  /** Plays the video from a line's start. */
  onPlayFrom: (seconds: number) => void;
};

/**
 * A transcript's timestamped lines inside a page that already scrolls and already shows the
 * video (the Speech tab of Edit video). Tapping a line plays the video from there. Copying lines
 * and suggestions stay in `TranscriptSheet`, opened from the video's thumbnail.
 */
const TranscriptLines: React.FC<Props> = ({
  segments,
  playhead,
  onPlayFrom,
}) => {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const current = segmentAt(segments, playhead);

  if (segments.length === 0) {
    return <AppText color="textMuted">{t("transcriptEmpty")}</AppText>;
  }
  return (
    <View style={styles.lines}>
      {segments.map((segment, i) => (
        <Tappable
          key={i}
          onPress={() => onPlayFrom(segment.start)}
          accessibilityLabel={t("transcriptPlayFrom", {
            time: formatTime(segment.start),
          })}
          style={[styles.line, i === current && styles.currentLine]}
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
      ))}
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
  lines: { gap: theme.space.xs },
  line: {
    padding: theme.space.sm,
    gap: theme.space.xxs,
    borderRadius: theme.radius.md,
    overflow: "hidden",
  },
  currentLine: { backgroundColor: theme.colors.surfaceVariant },
  timeRow: { flexDirection: "row", alignItems: "center", gap: theme.space.xs },
}));

export default TranscriptLines;
