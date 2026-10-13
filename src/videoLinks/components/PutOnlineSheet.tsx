import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import BottomSheet from "@/src/common/components/BottomSheet";
import { AppText, Button } from "@/src/common/ui";
import { getCommonInput } from "@/src/common/utils/CommonStyles";
import { RevealTextInput } from "@/src/common/components/reveal";
import { awaitingLink } from "@/src/videoLinks/awaitingLink";
import { applyVideoLink, videoIsBusy } from "@/src/videoLinks/linkVideo";
import { canShareVideos, shareVideoFile } from "@/src/videoLinks/shareVideo";
import { isWebUrl } from "@/src/videoLinks/videoLinks";

/** The local video to put online, in the list and pattern that hold it. */
export type PutOnlineTarget = {
  listId: string;
  sourceUri: string;
  patternName: string;
};

type Props = {
  target: PutOnlineTarget | null;
  onClose: () => void;
};

/**
 * *Put online*: the two steps that turn a local video into a link a published list can carry.
 * First the video goes out through the system share sheet to whatever app the user uploads with;
 * then its link comes back, shared to DPM from that app (`ShareInHandler`) or pasted here, and
 * takes the video's place (`applyVideoLink`). DPM uploads nothing itself.
 *
 * Rendered only while open, so each video starts with an empty field.
 */
const PutOnlineSheet: React.FC<Props> = ({ target, onClose }) => {
  const { t } = useTranslation();
  return (
    <BottomSheet
      visible={!!target}
      onClose={onClose}
      title={t("videoOnlineTitle")}
      minHeight="50%"
      maxHeight="85%"
    >
      {target && (
        <PutOnlineBody
          key={target.sourceUri}
          target={target}
          onClose={onClose}
        />
      )}
    </BottomSheet>
  );
};

const PutOnlineBody: React.FC<{
  target: PutOnlineTarget;
  onClose: () => void;
}> = ({ target, onClose }) => {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const [canShare, setCanShare] = useState(false);
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const busy = videoIsBusy(target.sourceUri);

  useEffect(() => {
    let cancelled = false;
    void canShareVideos().then((can) => {
      if (!cancelled) setCanShare(can);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const share = async () => {
    // Waits from now on: the link may come back through the share menu, with this sheet closed.
    awaitingLink.set(target);
    try {
      await shareVideoFile(target.sourceUri, t("videoOnlineShare"));
    } catch (e) {
      console.error("Could not share the video:", e);
      setError(t("videoOnlineShareFailed"));
    }
  };

  const submitLink = async () => {
    const trimmed = url.trim();
    if (!isWebUrl(trimmed)) {
      setError(t(trimmed ? "videoUrlInvalid" : "videoUrlRequired"));
      return;
    }
    setSaving(true);
    try {
      await applyVideoLink(target.listId, target.sourceUri, trimmed);
      onClose();
    } catch (e) {
      console.error("Could not use the link:", e);
      setError(t("videoOnlineLinkFailed"));
      setSaving(false);
    }
  };

  return (
    <View>
      <AppText color="textMuted" style={styles.paragraph}>
        {t("videoOnlineIntro")}
      </AppText>
      {canShare && (
        <>
          <AppText variant="label" style={styles.step}>
            {t("videoOnlineStepShare")}
          </AppText>
          <Button
            title={t("videoOnlineShare")}
            icon="share-variant"
            variant="secondary"
            onPress={share}
            disabled={busy}
          />
        </>
      )}
      <AppText variant="label" style={styles.step}>
        {t("videoOnlineStepLink")}
      </AppText>
      <AppText color="textMuted" style={styles.paragraph}>
        {t("videoOnlineLinkHint")}
      </AppText>
      <RevealTextInput
        style={[styles.input, error ? styles.inputError : null]}
        placeholder={t("videoUrl")}
        placeholderTextColor={theme.colors.textMuted}
        value={url}
        onChangeText={(text) => {
          setUrl(text);
          if (error) setError("");
        }}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        accessibilityLabel={t("videoUrl")}
      />
      {!!error && (
        <AppText variant="caption" color="danger" style={styles.error}>
          {error}
        </AppText>
      )}
      <Button
        title={t("videoOnlineUseLink")}
        icon="link-variant"
        onPress={submitLink}
        disabled={busy || saving}
      />
      <AppText variant="caption" color="textMuted" style={styles.note}>
        {busy ? t("videoOnlineBusy") : t("videoOnlineReplaceNote")}
      </AppText>
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
  paragraph: { marginBottom: theme.space.sm },
  step: { marginTop: theme.space.sm, marginBottom: theme.space.xs },
  input: { ...getCommonInput(theme), marginBottom: theme.space.sm },
  inputError: { borderColor: theme.colors.danger },
  error: { marginTop: -theme.space.xs, marginBottom: theme.space.sm },
  note: { marginTop: theme.space.sm },
}));

export default PutOnlineSheet;
