import React, { useState } from "react";
import { View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import { AppText, Button, SwitchRow } from "@/src/common/ui";
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
 * The Speech tab of Edit video (L4): transcribe what is said, or open the transcript there
 * already is. The first transcription needs the speech model; its size shows under the button
 * until it is on the phone, and the job then fetches it. A silhouette has no sound (L3 drops
 * it), so it is not offered there.
 *
 * Where suggestions can run, a switch makes the same job go on to suggest a name and
 * description, which then waits for the user to review the suggestion. On by default once the
 * suggestion model is on the phone; off before, since that is a much larger download (named
 * under the switch).
 */
const TranscribeSection: React.FC<Props> = ({
  target,
  onStarted,
  onOpenTranscript,
}) => {
  const { t } = useTranslation();
  const startTranscription = useStartTranscription();
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
  // Named only while there is something to download.
  const download = installedModels()
    ? undefined
    : t("modelDownloadOnce", { size: TRANSCRIPTION_DOWNLOAD_MB });

  if (target.generated && !target.transcript) {
    return (
      <AppText variant="bodySmall" color="textMuted">
        {t("transcribeNoSound")}
      </AppText>
    );
  }

  if (target.transcript) {
    return (
      <>
        <AppText variant="bodySmall">{t("transcribeHasTranscript")}</AppText>
        <View style={styles.actions}>
          {onOpenTranscript && (
            <Button
              title={t("transcriptOpen")}
              icon="text-box-outline"
              onPress={onOpenTranscript}
            />
          )}
          {!target.generated && (
            <Button
              title={t("transcribeAgain")}
              icon="refresh"
              variant="secondary"
              onPress={run}
            />
          )}
          {!target.generated && download ? (
            <AppText variant="caption" color="textMuted" style={styles.centred}>
              {download}
            </AppText>
          ) : null}
        </View>
      </>
    );
  }

  return (
    <>
      <AppText variant="bodySmall">{t("transcribeWhat")}</AppText>
      {offerSuggest && (
        <SwitchRow
          title={t("transcribeThenSuggest")}
          description={[
            t("transcribeThenSuggestWhat"),
            !suggestInstalled &&
              t("modelDownloadOnce", { size: SUGGESTION_DOWNLOAD_MB }),
          ]
            .filter(Boolean)
            .join(" ")}
          value={suggest}
          onValueChange={setSuggest}
        />
      )}
      <View style={styles.actions}>
        <Button title={t("transcribeRun")} icon="account-voice" onPress={run} />
        {download ? (
          <AppText variant="caption" color="textMuted" style={styles.centred}>
            {download}
          </AppText>
        ) : null}
      </View>
    </>
  );
};

const styles = StyleSheet.create((theme) => ({
  actions: { gap: theme.space.sm, marginTop: theme.space.xs },
  centred: { textAlign: "center" },
}));

export default TranscribeSection;
