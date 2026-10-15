import React, { useEffect, useState } from "react";
import RevealScrollView from "@/src/common/components/RevealScrollView";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import BottomSheet from "@/src/common/components/BottomSheet";
import { AppText, Button } from "@/src/common/ui";
import { getCommonInput } from "@/src/common/utils/CommonStyles";
import { RevealTextInput } from "@/src/common/components/reveal";
import { awaitingLink } from "@/src/videoLinks/awaitingLink";
import { applyVideoLink, videoIsBusy } from "@/src/videoLinks/linkVideo";
import { canReadClipboard, readCopiedText } from "@/src/videoLinks/clipboard";
import { canShareVideos, shareVideoFile } from "@/src/videoLinks/shareVideo";
import { findWebUrl, isWebUrl, playsInApp } from "@/src/videoLinks/videoLinks";

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
 * The share menu says nothing about what happened in the other app, so once it returns, step 1
 * reads as done and the sheet turns to the link. A link DPM cannot play (a Drive page) needs a
 * second tap: it would reach subscribers as a video that does not play.
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
  /** The share menu came back: the video went to an app, or the user closed the menu. */
  const [shared, setShared] = useState(false);
  /** The link already warned about; using it again goes ahead. */
  const [warned, setWarned] = useState("");
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
      setShared(true);
    } catch (e) {
      console.error("Could not share the video:", e);
      setError(t("videoOnlineShareFailed"));
    }
  };

  const editUrl = (text: string) => {
    setUrl(text);
    if (error) setError("");
  };

  const paste = async () => {
    const copied = findWebUrl(await readCopiedText());
    if (copied) editUrl(copied);
    else setError(t("videoOnlineNoCopiedLink"));
  };

  const submitLink = async () => {
    const trimmed = url.trim();
    if (!isWebUrl(trimmed)) {
      setError(t(trimmed ? "videoUrlInvalid" : "videoUrlRequired"));
      return;
    }
    if (!playsInApp(trimmed) && warned !== trimmed) {
      setWarned(trimmed);
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

  const warning = !!url.trim() && warned === url.trim();

  return (
    <RevealScrollView keyboardShouldPersistTaps="handled">
      <AppText color="textMuted" style={styles.paragraph}>
        {t("videoOnlineIntro")}
      </AppText>
      {canShare && (
        <>
          <AppText variant="label" style={styles.step}>
            {shared ? t("videoOnlineStepShareDone") : t("videoOnlineStepShare")}
          </AppText>
          {shared && (
            <AppText color="textMuted" style={styles.paragraph}>
              {t("videoOnlineShared")}
            </AppText>
          )}
          <Button
            title={shared ? t("videoOnlineShareAgain") : t("videoOnlineShare")}
            icon="share-variant"
            variant={shared ? "ghost" : "secondary"}
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
      <AppText variant="caption" color="textMuted" style={styles.how}>
        {t("videoOnlineHowYouTube")}
      </AppText>
      <AppText variant="caption" color="textMuted" style={styles.paragraph}>
        {t("videoOnlineHowDrive")}
      </AppText>
      <RevealTextInput
        style={[styles.input, error ? styles.inputError : null]}
        placeholder={t("videoUrl")}
        placeholderTextColor={theme.colors.textMuted}
        value={url}
        onChangeText={editUrl}
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
      {canReadClipboard && (
        <Button
          title={t("videoOnlinePaste")}
          icon="content-paste"
          variant="ghost"
          onPress={paste}
          disabled={busy || saving}
          style={styles.paste}
        />
      )}
      {warning && (
        <AppText variant="caption" color="danger" style={styles.paragraph}>
          {t("videoLinkWontPlay")}
        </AppText>
      )}
      <Button
        title={warning ? t("videoLinkUseAnyway") : t("videoOnlineUseLink")}
        icon="link-variant"
        onPress={submitLink}
        disabled={busy || saving}
      />
      <AppText variant="caption" color="textMuted" style={styles.note}>
        {busy ? t("videoOnlineBusy") : t("videoOnlineReplaceNote")}
      </AppText>
    </RevealScrollView>
  );
};

const styles = StyleSheet.create((theme) => ({
  paragraph: { marginBottom: theme.space.sm },
  step: { marginTop: theme.space.sm, marginBottom: theme.space.xs },
  input: { ...getCommonInput(theme), marginBottom: theme.space.sm },
  inputError: { borderColor: theme.colors.danger },
  error: { marginTop: -theme.space.xs, marginBottom: theme.space.sm },
  how: { marginBottom: theme.space.xs },
  paste: { marginBottom: theme.space.sm },
  note: { marginTop: theme.space.sm },
}));

export default PutOnlineSheet;
