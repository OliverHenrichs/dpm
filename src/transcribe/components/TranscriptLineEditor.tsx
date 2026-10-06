import React, { useState } from "react";
import { TextInput, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import { AppText, Button } from "@/src/common/ui";
import { getCommonInput } from "@/src/common/utils/CommonStyles";
import { formatTime } from "@/src/common/utils/TImeUtils";
import { ITranscriptSegment } from "@/src/pattern/types/IPatternList";

type Props = {
  segment: ITranscriptSegment;
  /** Takes the corrected text; an empty one removes the line. */
  onSave: (text: string) => void;
  onCancel: () => void;
};

/**
 * One transcript line being corrected by hand, in place of the line: the model mishears dance
 * slang, and a transcript is copied into descriptions and suggested from. Nothing changes until
 * Save; emptying the line and saving removes it.
 */
const TranscriptLineEditor: React.FC<Props> = ({
  segment,
  onSave,
  onCancel,
}) => {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const [text, setText] = useState(segment.text);
  const time = formatTime(segment.start);

  return (
    <View style={styles.editor}>
      <AppText variant="caption" color="textMuted">
        {time}
      </AppText>
      <TextInput
        style={styles.input}
        value={text}
        onChangeText={setText}
        multiline
        autoFocus
        accessibilityLabel={t("transcriptLineInput", { time })}
        placeholder={t("transcriptLineRemoveHint")}
        placeholderTextColor={theme.colors.textMuted}
      />
      <View style={styles.actions}>
        <Button
          title={t("cancel")}
          variant="secondary"
          size="sm"
          onPress={onCancel}
          style={styles.action}
        />
        <Button
          title={
            text.trim() ? t("transcriptLineSave") : t("transcriptLineRemove")
          }
          size="sm"
          onPress={() => onSave(text)}
          style={styles.action}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
  editor: {
    flex: 1,
    padding: theme.space.sm,
    gap: theme.space.xs,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceVariant,
  },
  input: {
    ...getCommonInput(theme),
    ...theme.typography.body,
    backgroundColor: theme.colors.background,
  },
  actions: { flexDirection: "row", gap: theme.space.sm },
  action: { flex: 1 },
}));

export default TranscriptLineEditor;
