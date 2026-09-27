import React, { useState } from "react";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Button, ListRow } from "@/src/common/ui";
import { commonStyles } from "@/src/common/utils/CommonStyles";
import { isAudioExtractAvailable } from "@/modules/audio-extract";
import { deleteModels, installedModels } from "@/src/transcribe/modelStore";
import { TRANSCRIPTION_DOWNLOAD_MB } from "@/src/transcribe/models";

/**
 * Settings' view of the speech model (L4): whether it is on the device, and a way to free the
 * space. It comes back on the next transcription, after the same size notice as the first time.
 */
const SpeechModelRow: React.FC = () => {
  const { t } = useTranslation();
  const [installed, setInstalled] = useState(() => installedModels() !== null);
  if (!isAudioExtractAvailable) return null;

  return (
    <>
      <View style={commonStyles.sectionHeaderRow}>
        <Text style={commonStyles.sectionTitle}>{t("speechModel")}</Text>
      </View>
      <ListRow
        variant="card"
        icon="account-voice"
        title={t(installed ? "speechModelInstalled" : "speechModelMissing")}
        meta={`${TRANSCRIPTION_DOWNLOAD_MB} MB`}
        subtitle={t("speechModelHint")}
        trailing={
          installed ? (
            <Button
              title={t("delete")}
              variant="dangerOutline"
              size="sm"
              onPress={() => {
                deleteModels();
                setInstalled(false);
              }}
            />
          ) : undefined
        }
      />
    </>
  );
};

export default SpeechModelRow;
