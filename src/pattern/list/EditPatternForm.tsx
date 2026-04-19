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
  IModifier,
  IPattern,
  IPatternModifierRef,
  IVideoReference,
  NewPattern,
} from "@/src/pattern/types/IPatternList";
import { PatternType } from "@/src/pattern/types/PatternType";
import { PatternLevel } from "@/src/pattern/types/PatternLevel";
import { useTranslation } from "react-i18next";
import { getPalette, PaletteColor } from "@/src/common/utils/ColorPalette";
import * as ImagePicker from "expo-image-picker";
import PatternVideos from "./PatternVideos";
import PatternTags from "./PatternTags";
import AddVideoModal from "./AddVideoModal";
import ModifierPillStrip from "./ModifierPillStrip";
import BottomSheet from "@/src/common/components/BottomSheet";
import { useThemeContext } from "@/src/common/components/ThemeContext";
import { generateVideoThumbnails } from "@/src/common/utils/YouTubeUtils";
import {
  getCommon2ndOrderLabel,
  getCommonBorder,
  getCommonButton,
  getCommonInput,
  getCommonLabel,
  getCommonPrereqContainer,
  getCommonPrereqItem,
  getCommonRow,
} from "@/src/common/utils/CommonStyles";

type EditPatternFormProps = {
  patterns: IPattern[];
  patternTypes: PatternType[];
  modifiers: IModifier[];
  onAccepted: (pattern: NewPattern | IPattern) => void;
  onCancel: () => void;
  existing?: IPattern | null;
};

const levels = Object.values(PatternLevel);

const EditPatternForm: React.FC<EditPatternFormProps> = ({
  patterns,
  patternTypes,
  modifiers,
  onAccepted,
  onCancel,
  existing,
}) => {
  const { t } = useTranslation();

  const createDefaultPattern = (): NewPattern => ({
    name: "",
    typeId: patternTypes[0]?.id || "",
    counts: 6,
    level: PatternLevel.BEGINNER,
    prerequisites: [],
    description: "",
    tags: [],
    videoRefs: [],
    modifierRefs: [],
  });

  const [newPattern, setNewPattern] = useState<NewPattern>(
    existing ?? createDefaultPattern(),
  );
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [prereqFilter, setPrereqFilter] = useState<string>("");
  const [showAddVideoModal, setShowAddVideoModal] = useState(false);
  const [selectedModifierId, setSelectedModifierId] = useState<string | null>(
    null,
  );
  const [showAttachPicker, setShowAttachPicker] = useState(false);

  const { colorScheme } = useThemeContext();
  const palette = getPalette(colorScheme);
  const styles = getStyles(palette);

  // Resolve which videoRefs are currently active for the selected pill
  const activeVideoRefs: IVideoReference[] = (() => {
    if (selectedModifierId === null) return newPattern.videoRefs ?? [];
    const mod = modifiers.find((m) => m.id === selectedModifierId);
    if (!mod) return [];
    if (mod.universal) return mod.videoRefs ?? []; // read-only
    const ref = (newPattern.modifierRefs ?? []).find(
      (r) => r.modifierId === selectedModifierId,
    );
    return ref?.videoRefs ?? [];
  })();

  // True when the currently-selected pill is a universal modifier (read-only)
  const isActiveVideoReadonly = (() => {
    if (selectedModifierId === null) return false;
    return (
      modifiers.find((m) => m.id === selectedModifierId)?.universal ?? false
    );
  })();

  useEffect(() => {
    generateVideoThumbnails(activeVideoRefs).then(setThumbnails);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedModifierId, newPattern.videoRefs, newPattern.modifierRefs]);

  const handleFinish = () => {
    onAccepted(newPattern);
    setNewPattern(createDefaultPattern());
  };

  const openAddVideoModal = () => {
    if (activeVideoRefs.length >= 3) return;
    setShowAddVideoModal(true);
  };

  const handlePickFromLibrary = async () => {
    if (activeVideoRefs.length >= 3) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["videos"],
      allowsMultipleSelection: true,
      selectionLimit: 3 - activeVideoRefs.length,
    });
    if (!result.canceled) {
      const newVideos: IVideoReference[] = result.assets.map((asset) => ({
        type: "local",
        value: asset.uri,
      }));
      applyVideoAdd(newVideos);
    }
  };

  const handleAddUrlVideo = (url: string, startTime?: number) => {
    const newRef: IVideoReference = {
      type: "url",
      value: url,
      ...(startTime !== undefined && { startTime }),
    };
    applyVideoAdd([newRef]);
  };

  const applyVideoAdd = (newRefs: IVideoReference[]) => {
    if (selectedModifierId === null) {
      setNewPattern((prev) => ({
        ...prev,
        videoRefs: [...(prev.videoRefs ?? []), ...newRefs],
      }));
    } else {
      setNewPattern((prev) => ({
        ...prev,
        modifierRefs: (prev.modifierRefs ?? []).map((ref) =>
          ref.modifierId === selectedModifierId
            ? { ...ref, videoRefs: [...ref.videoRefs, ...newRefs] }
            : ref,
        ),
      }));
    }
  };

  const handleRemoveVideo = (index: number) => {
    if (selectedModifierId === null) {
      setNewPattern((prev) => ({
        ...prev,
        videoRefs: prev.videoRefs?.filter((_, i) => i !== index) || [],
      }));
    } else {
      setNewPattern((prev) => ({
        ...prev,
        modifierRefs: (prev.modifierRefs ?? []).map((ref) =>
          ref.modifierId === selectedModifierId
            ? { ...ref, videoRefs: ref.videoRefs.filter((_, i) => i !== index) }
            : ref,
        ),
      }));
    }
  };

  const handleDetachModifier = (modifierId: string) => {
    setNewPattern((prev) => ({
      ...prev,
      modifierRefs: (prev.modifierRefs ?? []).filter(
        (ref) => ref.modifierId !== modifierId,
      ),
    }));
    if (selectedModifierId === modifierId) setSelectedModifierId(null);
  };

  const handleAttachModifier = (modifierId: string) => {
    if (
      (newPattern.modifierRefs ?? []).some((r) => r.modifierId === modifierId)
    )
      return;
    const newRef: IPatternModifierRef = { modifierId, videoRefs: [] };
    setNewPattern((prev) => ({
      ...prev,
      modifierRefs: [...(prev.modifierRefs ?? []), newRef],
    }));
    setSelectedModifierId(modifierId);
    setShowAttachPicker(false);
  };

  // Non-universal modifiers not yet attached to this pattern
  const unattachedModifiers = modifiers.filter(
    (m) =>
      !m.universal &&
      !(newPattern.modifierRefs ?? []).some((r) => r.modifierId === m.id),
  );

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
              onPress={() => setNewPattern({ ...newPattern, level })}
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

      {/* Modifier pill strip (only shown when modifiers exist) */}
      {modifiers.length > 0 && (
        <View style={styles.modifierSection}>
          <ModifierPillStrip
            modifiers={modifiers}
            modifierRefs={newPattern.modifierRefs ?? []}
            selectedModifierId={selectedModifierId}
            onSelect={setSelectedModifierId}
            isEditMode
            onDetachModifier={handleDetachModifier}
            onShowAttachPicker={
              unattachedModifiers.length > 0
                ? () => setShowAttachPicker(true)
                : undefined
            }
          />
          {isActiveVideoReadonly && (
            <Text style={styles.readonlyHint}>
              {t("universalVideosReadonly")}
            </Text>
          )}
        </View>
      )}

      {/* Videos — contextual based on pill selection */}
      <PatternVideos
        videoRefs={activeVideoRefs}
        thumbnails={thumbnails}
        onAddVideo={openAddVideoModal}
        onRemoveVideo={handleRemoveVideo}
        palette={palette}
        disabled={isActiveVideoReadonly || activeVideoRefs.length >= 3}
      />
      <AddVideoModal
        visible={showAddVideoModal}
        onClose={() => setShowAddVideoModal(false)}
        onPickFromLibrary={handlePickFromLibrary}
        onAddUrl={handleAddUrlVideo}
        palette={palette}
      />

      {/* Attach modifier picker */}
      <BottomSheet
        visible={showAttachPicker}
        onClose={() => setShowAttachPicker(false)}
        title={t("attachModifier")}
        palette={palette}
        minHeight="20%"
        maxHeight="50%"
      >
        {unattachedModifiers.map((mod) => (
          <TouchableOpacity
            key={mod.id}
            style={styles.attachPickerItem}
            onPress={() => handleAttachModifier(mod.id)}
          >
            <Text style={styles.attachPickerItemText}>{mod.name}</Text>
            <Text style={styles.attachPickerPositionText}>
              {mod.position === "prefix"
                ? t("modifierPositionPrefix")
                : mod.position === "postfix"
                  ? t("modifierPositionPostfix")
                  : t("modifierPositionAmends")}
            </Text>
          </TouchableOpacity>
        ))}
      </BottomSheet>

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
    input: { flex: 1, height: "100%", ...baseInput },
    textarea: { ...baseInput, minHeight: 48 },
    label: { ...getCommonLabel(palette) },
    otherLabel: { ...getCommon2ndOrderLabel(palette) },
    prereqContainer: getCommonPrereqContainer(palette),
    filterInput: { ...baseInput, height: 40, marginBottom: 8 },
    prereqItem: getCommonPrereqItem(palette),
    prereqItemSelected: { backgroundColor: palette[PaletteColor.Primary] },
    prereqItemText: { color: palette[PaletteColor.PrimaryText], fontSize: 14 },
    prereqItemTextSelected: {
      color: palette[PaletteColor.Surface],
      fontWeight: "bold",
    },
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
    videosRow,
    videosInputRow,
    addButtonContainer: {
      justifyContent: "center",
      alignItems: "center",
      height: 64,
      marginLeft: 8,
    },
    modifierSection: {
      ...getCommonPrereqContainer(palette),
    },
    readonlyHint: {
      fontSize: 11,
      color: palette[PaletteColor.SecondaryText],
      fontStyle: "italic",
      marginTop: 4,
    },
    attachPickerItem: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: palette[PaletteColor.Border],
    },
    attachPickerItemText: {
      fontSize: 15,
      color: palette[PaletteColor.PrimaryText],
      fontWeight: "500",
    },
    attachPickerPositionText: {
      fontSize: 12,
      color: palette[PaletteColor.SecondaryText],
    },
  });
};

export default EditPatternForm;
