import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { Button, Chip, SwitchRow } from "@/src/common/ui";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import * as ImagePicker from "expo-image-picker";
import { persistPickedVideos } from "@/src/pattern/data/videoFiles";
import { useTranslation } from "react-i18next";
import {
  IModifier,
  IVideoReference,
  ModifierPosition,
  NewModifier,
} from "@/src/pattern/types/IPatternList";
import PatternVideos from "@/src/pattern/list/PatternVideos";
import { MAX_VIDEOS } from "@/src/anonymize/jobs/replaceVideo";
import AddVideoModal from "@/src/pattern/list/AddVideoModal";
import { generateVideoThumbnails } from "@/src/common/utils/YouTubeUtils";
import {
  getCommonBorder,
  getCommonInput,
  getCommonLabel,
  getCommonPrereqContainer,
  getCommonRow,
} from "@/src/common/utils/CommonStyles";
import { RevealTextInput } from "@/src/common/components/reveal";
import RevealScrollView from "@/src/common/components/RevealScrollView";

type EditModifierFormProps = {
  onAccepted: (modifier: NewModifier | IModifier) => void;
  onCancel: () => void;
  existing?: IModifier | null;
};

const POSITIONS: ModifierPosition[] = ["prefix", "amends", "postfix"];

const EditModifierForm: React.FC<EditModifierFormProps> = ({
  onAccepted,
  onCancel,
  existing,
}) => {
  const { t } = useTranslation();
  const { theme } = useUnistyles();

  const createDefault = (): NewModifier => ({
    name: "",
    position: "amends",
    universal: false,
    videoRefs: [],
  });

  const [modifier, setModifier] = useState<NewModifier | IModifier>(
    existing ?? createDefault(),
  );
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [showAddVideoModal, setShowAddVideoModal] = useState(false);

  useEffect(() => {
    generateVideoThumbnails(modifier.videoRefs ?? []).then(setThumbnails);
  }, [modifier.videoRefs]);

  const handlePickFromLibrary = async () => {
    if ((modifier.videoRefs?.length ?? 0) >= MAX_VIDEOS) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["videos"],
      allowsMultipleSelection: true,
      selectionLimit: MAX_VIDEOS - (modifier.videoRefs?.length ?? 0),
    });
    if (!result.canceled) {
      const uris = await persistPickedVideos(result.assets.map((a) => a.uri));
      const newVideos: IVideoReference[] = uris.map((value) => ({
        type: "local",
        value,
      }));
      setModifier((prev) => ({
        ...prev,
        videoRefs: [...(prev.videoRefs ?? []), ...newVideos],
      }));
    }
  };

  const handleAddUrlVideo = (url: string, startTime?: number) => {
    const newRef: IVideoReference = {
      type: "url",
      value: url,
      ...(startTime !== undefined && { startTime }),
    };
    setModifier((prev) => ({
      ...prev,
      videoRefs: [...(prev.videoRefs ?? []), newRef],
    }));
  };

  const handleRemoveVideo = (index: number) => {
    setModifier((prev) => ({
      ...prev,
      videoRefs: prev.videoRefs?.filter((_, i) => i !== index) || [],
    }));
  };

  const handleFinish = () => {
    if (!modifier.name.trim()) return;
    // An optional field that reaches a published list goes absent, never empty.
    const { description, ...rest } = modifier;
    const trimmed = description?.trim();
    onAccepted(trimmed ? { ...rest, description: trimmed } : rest);
  };

  // Save and Cancel stay outside the scroller, so they are in sight however long the form is.
  return (
    <View style={styles.form}>
      <RevealScrollView>
        <View style={styles.container}>
          <Text style={styles.sectionTitle}>
            {existing ? t("editModifier") : t("addModifier")}
          </Text>

          {/* Name */}
          <Text style={styles.label}>{t("modifierName")}</Text>
          <RevealTextInput
            placeholder={t("modifierName")}
            value={modifier.name}
            onChangeText={(text) => setModifier({ ...modifier, name: text })}
            style={styles.input}
            placeholderTextColor={theme.colors.textMuted}
          />

          {/* Description */}
          <Text style={styles.label}>{t("modifierDescription")}</Text>
          <RevealTextInput
            placeholder={t("modifierDescriptionPlaceholder")}
            value={modifier.description ?? ""}
            onChangeText={(text) =>
              setModifier({ ...modifier, description: text })
            }
            multiline
            style={styles.input}
            placeholderTextColor={theme.colors.textMuted}
            accessibilityLabel={t("modifierDescription")}
          />

          {/* Position */}
          <View style={styles.prereqContainer}>
            <Text style={styles.label}>{t("modifierPosition")}</Text>
            <View style={styles.row}>
              {POSITIONS.map((pos) => (
                <Chip
                  key={pos}
                  label={t(
                    `modifierPosition${pos.charAt(0).toUpperCase()}${pos.slice(1)}`,
                  )}
                  selected={modifier.position === pos}
                  onPress={() => setModifier({ ...modifier, position: pos })}
                />
              ))}
            </View>
          </View>

          {/* Universal toggle */}
          <SwitchRow
            title={t("universalModifier")}
            value={modifier.universal}
            onValueChange={(val) =>
              setModifier({ ...modifier, universal: val })
            }
            style={styles.switchRow}
          />

          {/* Videos — only for universal modifiers */}
          {modifier.universal && (
            <>
              <PatternVideos
                videoRefs={modifier.videoRefs ?? []}
                thumbnails={thumbnails}
                onAddVideo={() => setShowAddVideoModal(true)}
                onRemoveVideo={handleRemoveVideo}
                disabled={(modifier.videoRefs?.length ?? 0) >= MAX_VIDEOS}
                full={(modifier.videoRefs?.length ?? 0) >= MAX_VIDEOS}
              />
              <AddVideoModal
                visible={showAddVideoModal}
                onClose={() => setShowAddVideoModal(false)}
                onPickFromLibrary={handlePickFromLibrary}
                onAddUrl={handleAddUrlVideo}
              />
            </>
          )}
        </View>
      </RevealScrollView>
      {/* Buttons */}
      <View style={styles.buttonRow}>
        <Button
          title={t("cancel")}
          variant="secondary"
          onPress={onCancel}
          style={styles.footerButton}
        />
        <Button
          title={t("saveModifier")}
          onPress={handleFinish}
          style={styles.footerButton}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create((theme) => {
  const baseInput = getCommonInput(theme);
  return {
    form: { flexShrink: 1 },
    container: {
      ...getCommonBorder(theme),
      padding: theme.space.sm,
      backgroundColor: theme.colors.surface,
    },
    sectionTitle: {
      ...theme.typography.title,
      color: theme.colors.text,
      marginBottom: theme.space.sm,
    },
    label: getCommonLabel(theme),
    input: {
      ...baseInput,
      marginBottom: theme.space.sm,
    },
    prereqContainer: {
      ...getCommonPrereqContainer(theme),
    },
    row: {
      ...getCommonRow(),
      gap: theme.space.sm,
      flexWrap: "wrap",
    },
    switchRow: {
      marginVertical: theme.space.sm,
    },
    buttonRow: {
      ...getCommonRow(),
      gap: theme.space.sm,
      marginTop: theme.space.sm,
    },
    footerButton: { flex: 1 },
  };
});

export default EditModifierForm;
