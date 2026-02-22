import React, { useEffect, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  NewPattern,
  Pattern,
  VideoReference,
} from "@/components/pattern/types/PatternList";
import { PatternType } from "@/components/pattern/types/PatternType";
import { WCSPatternLevel } from "@/components/pattern/types/WCSPatternEnums";
import { useTranslation } from "react-i18next";
import { getPalette, PaletteColor } from "@/components/common/ColorPalette";
import * as ImagePicker from "expo-image-picker";
import * as VideoThumbnails from "expo-video-thumbnails";
import PatternVideos from "./PatternVideos";
import PatternTags from "./PatternTags";
import { useThemeContext } from "@/components/common/ThemeContext";
import {
  getCommon2ndOrderLabel,
  getCommonBorder,
  getCommonButton,
  getCommonInput,
  getCommonLabel,
  getCommonPrereqContainer,
  getCommonPrereqItem,
  getCommonRow,
} from "@/components/common/CommonStyles";

type EditPatternFormProps = {
  patterns: Pattern[];
  patternTypes: PatternType[]; // Dynamic pattern types from active list
  onAccepted: (pattern: NewPattern | Pattern) => void;
  onCancel: () => void;
  existing?: Pattern | null;
};

const levels = Object.values(WCSPatternLevel);

const EditPatternForm: React.FC<EditPatternFormProps> = ({
  patterns,
  patternTypes,
  onAccepted,
  onCancel,
  existing,
}) => {
  const { t } = useTranslation();

  // Create default pattern with first type
  const createDefaultPattern = (): NewPattern => ({
    name: "",
    typeId: patternTypes[0]?.id || "",
    counts: 6,
    level: WCSPatternLevel.BEGINNER,
    prerequisites: [],
    description: "",
    tags: [],
    videoRefs: [],
  });

  const [newPattern, setNewPattern] = useState<NewPattern>(
    existing ?? createDefaultPattern(),
  );
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [prereqFilter, setPrereqFilter] = useState<string>("");

  useEffect(() => {
    const generateThumbnails = async () => {
      if (!newPattern.videoRefs || newPattern.videoRefs.length === 0) {
        setThumbnails([]);
        return;
      }
      const results: string[] = [];
      for (const ref of newPattern.videoRefs) {
        try {
          const { uri } = await VideoThumbnails.getThumbnailAsync(ref.value, {
            time: 1000,
            quality: 0.7,
          });
          results.push(uri);
        } catch {
          results.push("");
        }
      }
      setThumbnails(results);
    };
    generateThumbnails();
  }, [newPattern.videoRefs]);

  const handleFinish = () => {
    onAccepted(newPattern);
    setNewPattern(createDefaultPattern());
  };

  const handlePickVideos = async () => {
    if (newPattern.videoRefs && newPattern.videoRefs.length >= 3) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["videos"],
      allowsMultipleSelection: true,
      selectionLimit: 3 - (newPattern.videoRefs?.length ?? 0),
    });
    if (!result.canceled) {
      const newVideos: VideoReference[] = result.assets.map((asset) => ({
        type: "local",
        value: asset.uri,
      }));
      setNewPattern({
        ...newPattern,
        videoRefs: [...(newPattern.videoRefs ?? []), ...newVideos],
      });
    }
  };

  const handleRemoveVideo = (index: number) => {
    setNewPattern((prev) => ({
      ...prev,
      videoRefs: prev.videoRefs?.filter((_, i) => i !== index) || [],
    }));
  };

  const { colorScheme } = useThemeContext();
  const palette = getPalette(colorScheme);
  const styles = getStyles(palette);

  return (
    <View style={styles.addPatternContainer}>
      <Text style={styles.sectionTitle}>
        {existing ? t("editPattern") : t("addPattern")}
      </Text>
      <View style={styles.inputRow}>
        <View style={styles.input}>
          <Text style={styles.label}>{t("patternName")}</Text>
          <TextInput
            placeholder={t("patternName")}
            value={newPattern.name}
            onChangeText={(text) =>
              setNewPattern({ ...newPattern, name: text })
            }
            style={styles.input}
            placeholderTextColor={palette[PaletteColor.SecondaryText]}
          />
        </View>

        <View style={styles.input}>
          <Text style={styles.label}>{t("counts")}</Text>
          <TextInput
            placeholder={t("counts")}
            value={newPattern.counts.toString()}
            onChangeText={(text) =>
              setNewPattern({ ...newPattern, counts: parseInt(text) || 0 })
            }
            keyboardType="numeric"
            style={styles.input}
            placeholderTextColor={palette[PaletteColor.SecondaryText]}
          />
        </View>
      </View>
      <View style={styles.inputRow}>
        <View style={styles.input}>
          <Text style={styles.label}>{t("type")}</Text>
          {patternTypes.map((type) => (
            <TouchableOpacity
              key={type.id}
              style={[
                styles.prereqItem,
                newPattern.typeId === type.id && styles.prereqItemSelected,
                { borderLeftColor: type.color, borderLeftWidth: 4 },
              ]}
              onPress={() => setNewPattern({ ...newPattern, typeId: type.id })}
            >
              <Text
                style={[
                  styles.prereqItemText,
                  newPattern.typeId === type.id &&
                    styles.prereqItemTextSelected,
                ]}
              >
                {type.slug.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.input}>
          <Text style={styles.label}>{t("level")}</Text>
          {levels.map((level) => (
            <TouchableOpacity
              key={level}
              style={[
                styles.prereqItem,
                newPattern.level === level && styles.prereqItemSelected,
              ]}
              onPress={() =>
                setNewPattern({
                  ...newPattern,
                  level,
                })
              }
            >
              <Text style={styles.otherLabel}>{level}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <TextInput
        placeholder={t("description")}
        value={newPattern.description}
        onChangeText={(text) =>
          setNewPattern({ ...newPattern, description: text })
        }
        style={styles.textarea}
        multiline
        placeholderTextColor={palette[PaletteColor.SecondaryText]}
      />
      <View style={styles.prereqContainer}>
        <Text style={styles.label}>{t("prerequisites")}</Text>
        <TextInput
          placeholder={t("searchByName")}
          value={prereqFilter}
          onChangeText={setPrereqFilter}
          style={styles.filterInput}
          placeholderTextColor={palette[PaletteColor.SecondaryText]}
        />
        <ScrollView horizontal>
          {patterns
            .filter((p) =>
              prereqFilter
                ? p.name.toLowerCase().includes(prereqFilter.toLowerCase())
                : true,
            )
            .map((p) => (
              <TouchableOpacity
                key={p.id}
                style={[
                  styles.prereqItem,
                  newPattern.prerequisites.includes(p.id) &&
                    styles.prereqItemSelected,
                ]}
                onPress={() => {
                  if (newPattern.prerequisites.includes(p.id)) {
                    setNewPattern({
                      ...newPattern,
                      prerequisites: newPattern.prerequisites.filter(
                        (id: number) => id !== p.id,
                      ),
                    });
                  } else {
                    setNewPattern({
                      ...newPattern,
                      prerequisites: [...newPattern.prerequisites, p.id],
                    });
                  }
                }}
              >
                <Text style={styles.otherLabel}>{p.name}</Text>
              </TouchableOpacity>
            ))}
        </ScrollView>
      </View>
      <PatternTags
        tags={newPattern.tags}
        setTags={(tags) => setNewPattern({ ...newPattern, tags })}
        allPatterns={patterns}
        styles={styles}
      />
      <PatternVideos
        thumbnails={thumbnails}
        onAddVideo={handlePickVideos}
        onRemoveVideo={handleRemoveVideo}
        palette={palette}
        disabled={newPattern.videoRefs && newPattern.videoRefs.length >= 3}
      />
      <View style={styles.buttonRow}>
        <TouchableOpacity onPress={handleFinish} style={styles.buttonIndigo}>
          <Text style={styles.buttonText}>{t("savePattern")}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onCancel} style={styles.buttonCancel}>
          <Text style={styles.buttonText}>{t("cancel")}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const getStyles = (palette: Record<PaletteColor, string>) => {
  // Explicit ViewStyle for problematic styles
  const videosRow: import("react-native").ViewStyle = {
    flexDirection: "row",
    alignItems: "center",
  };
  const videosInputRow: import("react-native").ViewStyle = {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 64,
    height: 78,
  };
  const baseInput = getCommonInput(palette);
  const baseButton = getCommonButton(palette);
  const commonBorder = getCommonBorder(palette);
  return StyleSheet.create({
    // Containers
    addPatternContainer: {
      ...commonBorder,
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
    inputRow: { ...getCommonRow(), gap: 8, marginBottom: 8 },
    // Inputs
    input: {
      flex: 1,
      height: "100%",
      ...baseInput,
    },
    textarea: {
      ...baseInput,
      minHeight: 48,
    },
    // Labels
    label: { ...getCommonLabel(palette) },
    otherLabel: { ...getCommon2ndOrderLabel(palette) },
    // Prerequisites
    prereqContainer: getCommonPrereqContainer(palette),
    filterInput: {
      ...baseInput,
      height: 40,
      marginBottom: 8,
    },
    prereqItem: getCommonPrereqItem(palette),
    prereqItemSelected: { backgroundColor: palette[PaletteColor.Primary] },
    prereqItemText: {
      color: palette[PaletteColor.PrimaryText],
      fontSize: 14,
    },
    prereqItemTextSelected: {
      color: palette[PaletteColor.Surface],
      fontWeight: "bold",
    },
    // Buttons
    buttonRow: { ...getCommonRow(), gap: 8 },
    buttonRowWithBorder: { ...getCommonRow(), gap: 8 },
    buttonIndigo: { ...baseButton },
    buttonCancel: {
      ...baseButton,
      backgroundColor: palette[PaletteColor.Border],
    },
    buttonText: {
      color: palette[PaletteColor.PrimaryText],
      fontWeight: "bold",
    },
    // Videos
    videosRow,
    videosInputRow,
    addButtonContainer: {
      justifyContent: "center",
      alignItems: "center",
      height: 64,
      marginLeft: 8,
    },
  });
};

export default EditPatternForm;
