import React, { useState } from "react";
import { ScrollView, View } from "react-native";
import { router } from "expo-router";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import BottomSheet from "@/src/common/components/BottomSheet";
import { AppText, Button, ListRow } from "@/src/common/ui";
import { getCommonInput } from "@/src/common/utils/CommonStyles";
import { RevealTextInput } from "@/src/common/components/reveal";
import { fuzzyFilter } from "@/src/common/utils/fuzzyMatch";
import { MAX_VIDEOS } from "@/src/anonymize/jobs/replaceVideo";
import { persistVideo } from "@/src/pattern/data/videoFiles";
import { offerNewVideo } from "@/src/videoLinks/newVideoHandoff";
import { usePatternCrud } from "@/src/pattern/list/hooks/usePatternCrud";
import { IPattern, IVideoReference } from "@/src/pattern/types/IPatternList";

/** A video shared to DPM: a link, or a file the sharing app handed over. */
export type SharedVideo =
  { kind: "link"; url: string } | { kind: "video"; uri: string };

type Props = {
  shared: SharedVideo | null;
  onClose: () => void;
  /** The video went onto an existing pattern, by that pattern's name. */
  onAdded: (patternName: string) => void;
};

/**
 * Where a video shared to DPM goes: onto a pattern of the active list, or into a new one (the
 * List tab's add form opens with it, as for _From a video_). A shared file is copied into the
 * app's storage only once a place is chosen, so a dismissed share leaves nothing behind.
 */
const AddSharedVideoSheet: React.FC<Props> = ({ shared, onClose, onAdded }) => {
  const { t } = useTranslation();
  return (
    <BottomSheet
      visible={!!shared}
      onClose={onClose}
      title={t("shareInAddTitle")}
      minHeight="50%"
      maxHeight="85%"
    >
      {shared && (
        <AddSharedVideoBody
          shared={shared}
          onClose={onClose}
          onAdded={onAdded}
        />
      )}
    </BottomSheet>
  );
};

const AddSharedVideoBody: React.FC<{
  shared: SharedVideo;
  onClose: () => void;
  onAdded: (patternName: string) => void;
}> = ({ shared, onClose, onAdded }) => {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const { activeList, patterns, isReadonly, editPattern } = usePatternCrud();
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!activeList || isReadonly) {
    return (
      <View>
        <AppText color="textMuted" style={styles.paragraph}>
          {t("shareInNoList")}
        </AppText>
        <Button title={t("close")} onPress={onClose} />
      </View>
    );
  }

  const toReference = async (): Promise<IVideoReference> =>
    shared.kind === "link"
      ? { type: "url", value: shared.url }
      : { type: "local", value: await persistVideo(shared.uri) };

  // Errors are reported in the sheet, which stays open: the share is not lost.
  const place = async (work: (ref: IVideoReference) => Promise<void>) => {
    setSaving(true);
    setFailed(false);
    try {
      await work(await toReference());
    } catch (e) {
      console.error("Could not add the shared video:", e);
      setFailed(true);
      setSaving(false);
    }
  };

  const addToNewPattern = () =>
    place(async (ref) => {
      onClose();
      router.navigate({
        pathname: "/patterns",
        params: { newVideo: offerNewVideo(ref) },
      });
    });

  const addToPattern = (pattern: IPattern) =>
    place(async (ref) => {
      const accepted = await editPattern({
        ...pattern,
        videoRefs: [...pattern.videoRefs, ref],
      });
      if (!accepted) throw new Error("The pattern was not saved");
      onClose();
      onAdded(pattern.name);
      router.navigate("/patterns");
    });

  const byName = [...patterns].sort((a, b) => a.name.localeCompare(b.name));
  const shown = query.trim()
    ? fuzzyFilter(byName, query.trim(), (p) => p.name)
    : byName;

  return (
    <View style={styles.body}>
      <AppText color="textMuted" style={styles.paragraph}>
        {shared.kind === "link"
          ? t("shareInAddLink", { url: shared.url, list: activeList.name })
          : t("shareInAddVideo", { list: activeList.name })}
      </AppText>
      <Button
        title={t("shareInNewPattern")}
        icon="plus"
        onPress={addToNewPattern}
        disabled={saving}
      />
      {failed && (
        <AppText variant="caption" color="danger" style={styles.error}>
          {t("shareInFailed")}
        </AppText>
      )}
      {patterns.length > 0 && (
        <>
          <AppText variant="label" style={styles.step}>
            {t("shareInExistingPattern")}
          </AppText>
          <RevealTextInput
            style={styles.input}
            placeholder={t("searchByName")}
            placeholderTextColor={theme.colors.textMuted}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            accessibilityLabel={t("searchByName")}
          />
          <ScrollView
            style={styles.patterns}
            keyboardShouldPersistTaps="handled"
          >
            {shown.map((pattern) => {
              const full = pattern.videoRefs.length >= MAX_VIDEOS;
              return (
                <ListRow
                  key={pattern.id}
                  title={pattern.name}
                  meta={full ? t("shareInPatternFull") : undefined}
                  icon="video-plus-outline"
                  disabled={saving || full}
                  onPress={() => addToPattern(pattern)}
                />
              );
            })}
          </ScrollView>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
  body: { flexShrink: 1 },
  patterns: { flexShrink: 1 },
  paragraph: { marginBottom: theme.space.sm },
  step: { marginTop: theme.space.md, marginBottom: theme.space.xs },
  input: { ...getCommonInput(theme), marginBottom: theme.space.sm },
  error: { marginTop: theme.space.xs },
}));

export default AddSharedVideoSheet;
