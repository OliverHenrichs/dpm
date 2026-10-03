import React, { useState } from "react";
import { View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import { AppText, Button, Chip } from "@/src/common/ui";
import { isAudioExtractAvailable } from "@/modules/audio-extract";
import { IVideoReference } from "@/src/pattern/types/IPatternList";
import {
  installedModels,
  installedModelUri,
} from "@/src/transcribe/modelStore";
import { canSuggest } from "@/src/suggest/suggestPattern";
import { SUGGESTION_DOWNLOAD_MB, SUGGESTION_MODEL } from "@/src/suggest/models";
import { TRANSCRIPTION_DOWNLOAD_MB } from "@/src/transcribe/models";
import {
  TranscriptionTarget,
  useStartTranscription,
} from "@/src/transcribe/hooks/useStartTranscription";

type Props = {
  target: TranscriptionTarget &
    Pick<IVideoReference, "generated" | "transcript">;
  /** Called once a job is queued; the sheet closes, as it does for the other actions. */
  onStarted: () => void;
  /** Opens the video's transcript; omitted where there is nowhere to show it. */
  onOpenTranscript?: () => void;
};

/**
 * The speech part of Edit video (L4): transcribe what is said, or open the transcript there
 * already is. The first transcription needs the speech model; the user is told its size before
 * anything is downloaded, and the job then fetches it. A silhouette has no sound (L3 drops it),
 * so it is not offered there.
 *
 * Where suggestions can run, it can go on to suggest a name and description in the same job,
 * which then waits for the user to review the suggestion. On by default once the suggestion
 * model is on the phone; off before, since that is a much larger download (named on the chip).
 */
const TranscribeSection: React.FC<Props> = ({
  target,
  onStarted,
  onOpenTranscript,
}) => {
  const { t } = useTranslation();
  const startTranscription = useStartTranscription();
  const [confirmDownload, setConfirmDownload] = useState(false);
  const offerSuggest = canSuggest();
  const suggestInstalled =
    offerSuggest && installedModelUri(SUGGESTION_MODEL) !== null;
  const [suggest, setSuggest] = useState(suggestInstalled);

  if (!isAudioExtractAvailable) return null;

  const run = () => {
    // Detected afresh; the transcript view offers a fixed language for when detection is wrong.
    startTranscription(target, undefined, { suggest: offerSuggest && suggest });
    onStarted();
  };
  const suggestChip = offerSuggest && (
    <Chip
      label={
        suggestInstalled
          ? t("transcribeThenSuggest")
          : t("transcribeThenSuggestDownload", { size: SUGGESTION_DOWNLOAD_MB })
      }
      selected={suggest}
      onPress={() => setSuggest((on) => !on)}
    />
  );
  const onTranscribe = () => {
    if (installedModels()) run();
    else setConfirmDownload(true);
  };

  return (
    <View style={styles.section}>
      <AppText variant="label" color="textMuted">
        {t("transcribeSection")}
      </AppText>
      {target.generated && !target.transcript ? (
        <AppText variant="bodySmall" color="textMuted">
          {t("transcribeNoSound")}
        </AppText>
      ) : confirmDownload ? (
        <>
          <AppText variant="bodySmall">
            {t("transcribeDownloadHint", { size: TRANSCRIPTION_DOWNLOAD_MB })}
          </AppText>
          <View style={styles.row}>
            <Button
              title={t("cancel")}
              variant="secondary"
              onPress={() => setConfirmDownload(false)}
              style={styles.button}
            />
            <Button
              title={t("transcribeDownloadAndRun")}
              icon="download"
              onPress={run}
              style={styles.button}
            />
          </View>
        </>
      ) : target.transcript ? (
        <View style={styles.row}>
          {onOpenTranscript && (
            <Button
              title={t("transcriptOpen")}
              icon="text-box-outline"
              onPress={onOpenTranscript}
              style={styles.button}
            />
          )}
          {!target.generated && (
            <Button
              title={t("transcribeAgain")}
              icon="refresh"
              variant="secondary"
              onPress={onTranscribe}
              style={styles.button}
            />
          )}
        </View>
      ) : (
        <>
          {suggestChip}
          <Button
            title={t("transcribeRun")}
            icon="account-voice"
            variant="secondary"
            onPress={onTranscribe}
          />
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
  section: {
    gap: theme.space.sm,
    marginTop: theme.space.lg,
    paddingTop: theme.space.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  row: { flexDirection: "row", flexWrap: "wrap", gap: theme.space.sm },
  button: { flexGrow: 1 },
}));

export default TranscribeSection;
