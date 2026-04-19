import React, { useEffect, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useTranslation } from "react-i18next";
import { getPalette, PaletteColor } from "@/src/common/utils/ColorPalette";
import { useThemeContext } from "@/src/common/components/ThemeContext";
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
  getCommonButton,
  getCommonInput,
  getCommonLabel,
  getCommonPrereqContainer,
  getCommonPrereqItem,
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
  const { colorScheme } = useThemeContext();
  const palette = getPalette(colorScheme);
  const styles = getStyles(palette);

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
      const newVideos: IVideoReference[] = result.assets.map((asset) => ({
        type: "local",
        value: asset.uri,
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
          placeholderTextColor={palette[PaletteColor.SecondaryText]}
        />

        {/* Position */}
        <View style={styles.prereqContainer}>
          <Text style={styles.label}>{t("modifierPosition")}</Text>
          <View style={styles.row}>
            {POSITIONS.map((pos) => (
              <TouchableOpacity
                key={pos}
                style={[
                  styles.prereqItem,
                  modifier.position === pos && styles.prereqItemSelected,
                ]}
                onPress={() => setModifier({ ...modifier, position: pos })}
              >
                <Text
                  style={[
                    styles.pillText,
                    modifier.position === pos && styles.pillTextSelected,
                  ]}
                >
                  {t(
                    `modifierPosition${pos.charAt(0).toUpperCase()}${pos.slice(1)}`,
                  )}
                </Text>
              </TouchableOpacity>
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
              false: palette[PaletteColor.Border],
              true: palette[PaletteColor.Primary],
            }}
            thumbColor={palette[PaletteColor.Surface]}
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
              palette={palette}
              disabled={(modifier.videoRefs?.length ?? 0) >= 3}
            />
            <AddVideoModal
              visible={showAddVideoModal}
              onClose={() => setShowAddVideoModal(false)}
              onPickFromLibrary={handlePickFromLibrary}
              onAddUrl={handleAddUrlVideo}
              palette={palette}
            />
          </>
        )}

        {/* Buttons */}
        <View style={styles.buttonRow}>
          <TouchableOpacity onPress={handleFinish} style={styles.buttonSave}>
            <Text style={styles.buttonText}>{t("saveModifier")}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onCancel} style={styles.buttonCancel}>
            <Text style={styles.buttonText}>{t("cancel")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
};

const getStyles = (palette: Record<PaletteColor, string>) => {
  const baseButton = getCommonButton(palette);
  const baseInput = getCommonInput(palette);
  return StyleSheet.create({
    container: {
      ...getCommonBorder(palette),
      padding: 8,
      marginBottom: 16,
      backgroundColor: palette[PaletteColor.Surface],
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: "bold",
      color: palette[PaletteColor.PrimaryText],
      marginBottom: 8,
    },
    label: getCommonLabel(palette),
    input: {
      ...baseInput,
      marginBottom: 8,
    },
    prereqContainer: {
      ...getCommonPrereqContainer(palette),
    },
    row: {
      ...getCommonRow(),
      gap: 6,
      flexWrap: "wrap",
    },
    prereqItem: getCommonPrereqItem(palette),
    prereqItemSelected: {
      backgroundColor: palette[PaletteColor.Primary],
      borderColor: palette[PaletteColor.Primary],
    },
    pillText: {
      fontSize: 13,
      color: palette[PaletteColor.PrimaryText],
    },
    pillTextSelected: {
      color: palette[PaletteColor.Surface],
      fontWeight: "600",
    },
    switchRow: {
      ...getCommonRow(),
      justifyContent: "space-between",
      marginVertical: 8,
    },
    buttonRow: {
      ...getCommonRow(),
      gap: 8,
      marginTop: 8,
    },
    buttonSave: { ...baseButton },
    buttonCancel: {
      ...baseButton,
      backgroundColor: palette[PaletteColor.Border],
    },
    buttonText: {
      color: palette[PaletteColor.PrimaryText],
      fontWeight: "bold",
    },
  });
};

export default EditModifierForm;
