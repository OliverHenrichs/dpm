import React, { useState } from "react";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Button, ListRow, type IconName } from "@/src/common/ui";
import { commonStyles } from "@/src/common/utils/CommonStyles";
import { isAudioExtractAvailable } from "@/modules/audio-extract";
import {
  deleteModel,
  deleteModels,
  installedModels,
  installedModelUri,
} from "@/src/transcribe/modelStore";
import { TRANSCRIPTION_DOWNLOAD_MB } from "@/src/transcribe/models";
import { SUGGESTION_DOWNLOAD_MB, SUGGESTION_MODEL } from "@/src/suggest/models";
import { canSuggest } from "@/src/suggest/suggestPattern";

/**
 * Settings' view of the models the app downloads on first use (L4): whether each is on the
 * phone, and a way to free its space. Each comes back on next use, after the same size notice as
 * the first time.
 */
const DeviceModelsSection: React.FC = () => {
  const { t } = useTranslation();
  if (!isAudioExtractAvailable) return null;
  return (
    <>
      <View style={commonStyles.sectionHeaderRow}>
        <Text style={commonStyles.sectionTitle}>{t("deviceModels")}</Text>
      </View>
      <ModelRow
        icon="account-voice"
        title={t("speechModel")}
        hint={t("speechModelHint")}
        sizeMb={TRANSCRIPTION_DOWNLOAD_MB}
        isInstalled={() => installedModels() !== null}
        onDelete={deleteModels}
      />
      {canSuggest() && (
        <ModelRow
          icon="lightbulb-on-outline"
          title={t("suggestionModel")}
          hint={t("suggestionModelHint")}
          sizeMb={SUGGESTION_DOWNLOAD_MB}
          isInstalled={() => installedModelUri(SUGGESTION_MODEL) !== null}
          onDelete={() => deleteModel(SUGGESTION_MODEL)}
        />
      )}
    </>
  );
};

const ModelRow: React.FC<{
  icon: IconName;
  title: string;
  hint: string;
  sizeMb: number;
  isInstalled: () => boolean;
  onDelete: () => void;
}> = ({ icon, title, hint, sizeMb, isInstalled, onDelete }) => {
  const { t } = useTranslation();
  const [installed, setInstalled] = useState(isInstalled);
  return (
    <ListRow
      variant="card"
      icon={icon}
      title={title}
      meta={`${sizeMb} MB`}
      subtitle={`${t(installed ? "speechModelInstalled" : "speechModelMissing")} · ${hint}`}
      trailing={
        installed ? (
          <Button
            title={t("delete")}
            variant="dangerOutline"
            size="sm"
            onPress={() => {
              onDelete();
              setInstalled(false);
            }}
            accessibilityLabel={t("deleteModel", { name: title })}
          />
        ) : undefined
      }
    />
  );
};

export default DeviceModelsSection;
