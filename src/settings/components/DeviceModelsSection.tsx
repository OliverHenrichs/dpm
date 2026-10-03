import React, { useEffect, useState } from "react";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Button, ListRow, type IconName } from "@/src/common/ui";
import { commonStyles } from "@/src/common/utils/CommonStyles";
import { isAudioExtractAvailable } from "@/modules/audio-extract";
import {
  deleteModel,
  deleteModels,
  downloadModel,
  ensureModels,
  installedModels,
  installedModelUri,
} from "@/src/transcribe/modelStore";
import { TRANSCRIPTION_DOWNLOAD_MB } from "@/src/transcribe/models";
import { SUGGESTION_DOWNLOAD_MB, SUGGESTION_MODEL } from "@/src/suggest/models";
import { canSuggest } from "@/src/suggest/suggestPattern";

/**
 * Settings' view of the models the app downloads on first use (L4): whether each is on the
 * phone, a way to fetch it ahead of time (on Wi-Fi, say, before the first use), and a way to free
 * its space. A deleted model comes back on next use, after the same size notice as the first
 * time. The size is on every row, so a download here is never a surprise either.
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
        onDownload={async (onFraction) => {
          await ensureModels(onFraction);
        }}
        onDelete={deleteModels}
      />
      {canSuggest() && (
        <ModelRow
          icon="lightbulb-on-outline"
          title={t("suggestionModel")}
          hint={t("suggestionModelHint")}
          sizeMb={SUGGESTION_DOWNLOAD_MB}
          isInstalled={() => installedModelUri(SUGGESTION_MODEL) !== null}
          onDownload={(onFraction) =>
            downloadModel(SUGGESTION_MODEL, (written) =>
              onFraction(written / SUGGESTION_MODEL.bytes),
            )
          }
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
  /** Fetches the model, reporting progress as a fraction. */
  onDownload: (onFraction: (fraction: number) => void) => Promise<void>;
  onDelete: () => void;
}> = ({ icon, title, hint, sizeMb, isInstalled, onDownload, onDelete }) => {
  const { t } = useTranslation();
  const [installed, setInstalled] = useState(isInstalled);
  // null while not downloading; the fraction done while it is.
  const [progress, setProgress] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);

  // A large download outlasts most screen timeouts, and a locked phone pauses it.
  const downloading = progress !== null;
  useEffect(() => {
    if (!downloading) return;
    activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => undefined);
    return () => {
      deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => undefined);
    };
  }, [downloading]);

  const download = async () => {
    setFailed(false);
    setProgress(0);
    try {
      await onDownload(setProgress);
      setInstalled(isInstalled());
    } catch {
      setFailed(true);
    } finally {
      setProgress(null);
    }
  };

  const state = downloading
    ? t("modelDownloading", { percent: Math.round(progress * 100) })
    : failed
      ? t("modelDownloadFailed")
      : t(installed ? "speechModelInstalled" : "speechModelMissing");
  return (
    <ListRow
      variant="card"
      icon={icon}
      title={title}
      meta={`${sizeMb} MB`}
      subtitle={`${state} · ${hint}`}
      trailing={
        downloading ? undefined : !installed ? (
          <Button
            title={t("modelDownload")}
            icon="download"
            variant="secondary"
            size="sm"
            onPress={download}
            accessibilityLabel={t("downloadModel", { name: title })}
          />
        ) : installed ? (
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

const KEEP_AWAKE_TAG = "model-download";

export default DeviceModelsSection;
