import React, { useEffect, useState } from "react";
import { ScrollView, Switch, Text, TextInput, View } from "react-native";
import { Button, Chip } from "@/src/common/ui";
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
import AddVideoModal from "@/src/pattern/list/AddVideoModal";
import { generateVideoThumbnails } from "@/src/common/utils/YouTubeUtils";
import {
  getCommonBorder,
  getCommonInput,
  getCommonLabel,
  getCommonPrereqContainer,
  getCommonRow,
} from "@/src/common/utils/CommonStyles";

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
    if (modifier.videoRefs && modifier.videoRefs.length >= 3) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["videos"],
      allowsMultipleSelection: true,
      selectionLimit: 3 - (modifier.videoRefs?.length ?? 0),
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
    onAccepted(modifier);
  };

  return (
    <ScrollView>
      <View style={styles.container}>
        <Text style={styles.sectionTitle}>
          {existing ? t("editModifier") : t("addModifier")}
        </Text>

        {/* Name */}
        <Text style={styles.label}>{t("modifierName")}</Text>
        <TextInput
          placeholder={t("modifierName")}
          value={modifier.name}
          onChangeText={(text) => setModifier({ ...modifier, name: text })}
          style={styles.input}
          placeholderTextColor={theme.colors.textMuted}
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
        <View style={styles.switchRow}>
          <Text style={styles.label}>{t("universalModifier")}</Text>
          <Switch
            value={modifier.universal}
            onValueChange={(val) =>
              setModifier({ ...modifier, universal: val })
            }
            trackColor={{
              false: theme.colors.border,
              true: theme.colors.primary,
            }}
            thumbColor={theme.colors.surface}
          />
        </View>

        {/* Videos — only for universal modifiers */}
        {modifier.universal && (
          <>
            <PatternVideos
              videoRefs={modifier.videoRefs ?? []}
              thumbnails={thumbnails}
              onAddVideo={() => setShowAddVideoModal(true)}
              onRemoveVideo={handleRemoveVideo}
              disabled={(modifier.videoRefs?.length ?? 0) >= 3}
            />
            <AddVideoModal
              visible={showAddVideoModal}
              onClose={() => setShowAddVideoModal(false)}
              onPickFromLibrary={handlePickFromLibrary}
              onAddUrl={handleAddUrlVideo}
            />
          </>
        )}

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
    </ScrollView>
  );
};

const styles = StyleSheet.create((theme) => {
  const baseInput = getCommonInput(theme);
  return {
    container: {
      ...getCommonBorder(theme),
      padding: theme.space.sm,
      marginBottom: theme.space.lg,
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
      ...getCommonRow(),
      justifyContent: "space-between",
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
