import React, { useEffect, useMemo, useState } from "react";
import {
  Image,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Button, Chip, ListRow } from "@/src/common/ui";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
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
import * as ImagePicker from "expo-image-picker";
import { persistPickedVideos } from "@/src/pattern/data/videoFiles";
import PatternVideos from "./PatternVideos";
import PatternTags from "./PatternTags";
import AddVideoModal from "./AddVideoModal";
import ModifierPillStrip from "./ModifierPillStrip";
import BottomSheet from "@/src/common/components/BottomSheet";
import { generateVideoThumbnails } from "@/src/common/utils/YouTubeUtils";
import { findIneligiblePrerequisiteIds } from "@/src/pattern/graph/utils/GenericGraphUtils";
import { useActivePatternList } from "@/src/pattern/data/components/ActivePatternListContext";
import DeidentifyModal, {
  DeidentifyTarget,
} from "@/src/deidentify/components/DeidentifyModal";
import { useDeidentifyJobs } from "@/src/deidentify/jobs/DeidentifyJobsContext";
import { applyReplacements } from "@/src/deidentify/jobs/replaceVideo";
import { jobStore } from "@/src/deidentify/jobs/jobStore";
import { canShortenVideos } from "@/src/deidentify/shortenVideo";
import {
  getCommonBorder,
  getCommonInput,
  getCommonLabel,
  getCommonPrereqContainer,
  getCommonRow,
} from "@/src/common/utils/CommonStyles";

type EditPatternFormProps = {
  patterns: IPattern[];
  patternTypes: PatternType[];
  modifiers: IModifier[];
  /**
   * Returning `false` (or a promise of it) means the save was refused and the
   * form should keep what the user has entered. `usePatternCrud` already
   * reports rejection that way.
   */
  onAccepted: (
    pattern: NewPattern | IPattern,
  ) => void | boolean | Promise<void | boolean>;
  onCancel: () => void;
  existing?: IPattern | null;
  /** Videos a new pattern starts with — "create a pattern from a video". */
  initialVideos?: IVideoReference[];
};

const levels = Object.values(PatternLevel);

const EditPatternForm: React.FC<EditPatternFormProps> = ({
  patterns,
  patternTypes,
  modifiers,
  onAccepted,
  onCancel,
  existing,
  initialVideos,
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
    videoRefs: initialVideos ?? [],
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
  const [showDeidentifyPicker, setShowDeidentifyPicker] = useState(false);
  const [deidentifyTarget, setDeidentifyTarget] =
    useState<DeidentifyTarget | null>(null);
  const { activeList } = useActivePatternList();
  const { jobs } = useDeidentifyJobs();

  // A de-identification job that finishes while this form is open replaced the video in the
  // stored pattern, not in this draft; swap it here too, so the form shows the result and
  // saving does not put the original back.
  useEffect(
    () =>
      jobStore.subscribe(() =>
        setNewPattern((prev) => applyReplacements(prev)),
      ),
    [],
  );

  /**
   * Patterns that cannot be prerequisites of this one without closing a cycle.
   *
   * Derived from the saved graph, not from the pending edit: which patterns
   * depend on this one is unaffected by what this form does to *its own*
   * prerequisites, so the set is stable for the life of the form. A pattern
   * being created has no dependents yet, so nothing is ineligible.
   */
  const ineligiblePrerequisiteIds = useMemo(
    () => findIneligiblePrerequisiteIds(patterns, existing?.id),
    [patterns, existing?.id],
  );
  const { theme } = useUnistyles();

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

  const handleFinish = async () => {
    // Only clear the form once the caller has taken the pattern. It used to
    // reset unconditionally, which quietly destroyed an edit the caller had
    // refused: a blank name leaves the modal open, so the user was left
    // looking at an empty "Edit Pattern" form with the pattern's type, counts,
    // videos and — fatally — its id all gone. Saving again then failed with
    // "Cannot edit pattern without id", so the form could not be escaped
    // except by cancelling.
    const accepted = await onAccepted(newPattern);
    if (accepted !== false) setNewPattern(createDefaultPattern());
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
      const uris = await persistPickedVideos(result.assets.map((a) => a.uri));
      const newVideos: IVideoReference[] = uris.map((value) => ({
        type: "local",
        value,
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

  // Editing a video (shorten, de-identify): one of this draft's own local videos, or one
  // picked from the gallery (added to the draft first). The run is a background job; see
  // src/deidentify/jobs/jobStore.ts.
  const canEditVideos =
    !!activeList &&
    !activeList.readonly &&
    !isActiveVideoReadonly &&
    canShortenVideos();
  const editable = activeVideoRefs
    .map((ref, index) => ({ ref, index }))
    .filter(({ ref }) => ref.type === "local");
  const draftUris = new Set(
    [
      ...(newPattern.videoRefs ?? []),
      ...(newPattern.modifierRefs ?? []).flatMap((m) => m.videoRefs),
    ].map((v) => v.value),
  );
  const draftJobs = jobs.filter(
    (j) => draftUris.has(j.sourceUri) && j.status !== "done",
  );

  const openEditor = (ref: IVideoReference) => {
    if (!activeList) return;
    setShowDeidentifyPicker(false);
    setDeidentifyTarget({
      listId: activeList.id,
      patternName: newPattern.name.trim() || t("addPatternNew"),
      sourceUri: ref.value,
      ...(ref.generated && { generated: ref.generated }),
    });
  };

  const pickForDeidentify = async () => {
    if (activeVideoRefs.length >= 3) return;
    setShowDeidentifyPicker(false);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["videos"],
      allowsMultipleSelection: false,
    });
    if (result.canceled || result.assets.length === 0) return;
    const [value] = await persistPickedVideos([result.assets[0].uri]);
    const ref: IVideoReference = { type: "local", value };
    applyVideoAdd([ref]);
    openEditor(ref);
  };

  const handleEditVideo = () => {
    if (editable.length === 0) void pickForDeidentify();
    else setShowDeidentifyPicker(true);
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
            placeholderTextColor={theme.colors.textMuted}
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
            placeholderTextColor={theme.colors.textMuted}
          />
        </View>
      </View>
      <View style={styles.inputRow}>
        <View style={styles.input}>
          <Text style={styles.label}>{t("type")}</Text>
          {patternTypes.map((type) => (
            <Chip
              key={type.id}
              label={type.slug.toUpperCase()}
              swatch={type.color}
              selected={newPattern.typeId === type.id}
              onPress={() => setNewPattern({ ...newPattern, typeId: type.id })}
            />
          ))}
        </View>
        <View style={styles.input}>
          <Text style={styles.label}>{t("level")}</Text>
          {levels.map((level) => (
            <Chip
              key={level}
              label={level}
              selected={newPattern.level === level}
              onPress={() => setNewPattern({ ...newPattern, level })}
            />
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
        placeholderTextColor={theme.colors.textMuted}
      />
      <View style={styles.prereqContainer}>
        <Text style={styles.label}>{t("prerequisites")}</Text>
        <TextInput
          placeholder={t("searchByName")}
          value={prereqFilter}
          onChangeText={setPrereqFilter}
          style={styles.filterInput}
          placeholderTextColor={theme.colors.textMuted}
        />
        <ScrollView horizontal>
          {patterns
            .filter((p) =>
              prereqFilter
                ? p.name.toLowerCase().includes(prereqFilter.toLowerCase())
                : true,
            )
            .map((p) => {
              const isSelected = newPattern.prerequisites.includes(p.id);
              // Picking something that already depends on this pattern — or
              // the pattern itself — would close a prerequisite cycle, and a
              // cycle has no valid learning order.
              const wouldCycle = ineligiblePrerequisiteIds.has(p.id);
              return (
                <Chip
                  key={p.id}
                  label={p.name}
                  selected={isSelected}
                  disabled={wouldCycle}
                  accessibilityHint={
                    wouldCycle ? t("prerequisiteWouldCycle") : undefined
                  }
                  onPress={() => {
                    if (isSelected) {
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
                />
              );
            })}
        </ScrollView>
        {ineligiblePrerequisiteIds.size > 0 && (
          <Text style={styles.prereqHint}>{t("prerequisiteWouldCycle")}</Text>
        )}
      </View>
      <PatternTags
        tags={newPattern.tags}
        setTags={(tags) => setNewPattern({ ...newPattern, tags })}
        allPatterns={patterns}
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
        onEditVideo={canEditVideos ? handleEditVideo : undefined}
        disabled={isActiveVideoReadonly || activeVideoRefs.length >= 3}
      />
      {draftJobs.map((job) => (
        <Text key={job.id} style={styles.jobLine}>
          {job.status === "queued"
            ? t("videoJobInFormQueued")
            : job.status === "running"
              ? t("videoJobInFormRunning", {
                  percent: Math.round(job.progress * 100),
                })
              : t("deidentifyFailed", { message: job.error ?? "" })}
        </Text>
      ))}
      <BottomSheet
        visible={showDeidentifyPicker}
        onClose={() => setShowDeidentifyPicker(false)}
        title={t("deidentifyChooseVideo")}
        minHeight="25%"
        maxHeight="50%"
      >
        <View style={styles.deidentifyChoices}>
          {editable.map(({ ref, index }) => (
            <TouchableOpacity
              key={ref.value}
              onPress={() => openEditor(ref)}
              accessibilityRole="button"
              accessibilityLabel={t("deidentifyVideoN", { n: index + 1 })}
            >
              {thumbnails[index] ? (
                <Image
                  source={{ uri: thumbnails[index] }}
                  style={styles.deidentifyThumb}
                />
              ) : (
                <View style={[styles.deidentifyThumb, styles.thumbFallback]}>
                  <Text style={styles.buttonText}>{index + 1}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
        <Button
          title={t("deidentifyFromGallery")}
          icon="image-plus"
          variant="secondary"
          onPress={pickForDeidentify}
          disabled={activeVideoRefs.length >= 3}
        />
      </BottomSheet>
      <DeidentifyModal
        target={deidentifyTarget}
        onClose={() => setDeidentifyTarget(null)}
      />
      <AddVideoModal
        visible={showAddVideoModal}
        onClose={() => setShowAddVideoModal(false)}
        onPickFromLibrary={handlePickFromLibrary}
        onAddUrl={handleAddUrlVideo}
      />

      {/* Attach modifier picker */}
      <BottomSheet
        visible={showAttachPicker}
        onClose={() => setShowAttachPicker(false)}
        title={t("attachModifier")}
        minHeight="20%"
        maxHeight="50%"
      >
        {unattachedModifiers.map((mod) => (
          <ListRow
            key={mod.id}
            title={mod.name}
            meta={
              mod.position === "prefix"
                ? t("modifierPositionPrefix")
                : mod.position === "postfix"
                  ? t("modifierPositionPostfix")
                  : t("modifierPositionAmends")
            }
            icon="plus-circle-outline"
            onPress={() => handleAttachModifier(mod.id)}
          />
        ))}
      </BottomSheet>

      <View style={styles.buttonRow}>
        <Button
          title={t("cancel")}
          variant="secondary"
          onPress={onCancel}
          style={styles.footerButton}
        />
        <Button
          title={t("savePattern")}
          onPress={handleFinish}
          style={styles.footerButton}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create((theme) => {
  const baseInput = getCommonInput(theme);
  const commonBorder = getCommonBorder(theme);
  return {
    addPatternContainer: {
      ...commonBorder,
      padding: theme.space.sm,
      marginBottom: theme.space.lg,
      backgroundColor: theme.colors.surface,
    },
    sectionTitle: {
      ...theme.typography.title,
      color: theme.colors.text,
      marginBottom: theme.space.sm,
    },
    inputRow: {
      ...getCommonRow(),
      gap: theme.space.sm,
      marginBottom: theme.space.sm,
    },
    input: { flex: 1, height: "100%", ...baseInput },
    textarea: { ...baseInput, minHeight: 48 },
    label: { ...getCommonLabel(theme) },
    prereqContainer: getCommonPrereqContainer(theme),
    filterInput: { ...baseInput, height: 40, marginBottom: theme.space.sm },
    prereqHint: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
      fontStyle: "italic",
      marginTop: theme.space.sm,
    },
    buttonRow: { ...getCommonRow(), gap: theme.space.sm },
    footerButton: { flex: 1 },
    buttonText: {
      color: theme.colors.text,
      fontWeight: "bold",
    },
    modifierSection: {
      ...getCommonPrereqContainer(theme),
    },
    readonlyHint: {
      ...theme.typography.micro,
      color: theme.colors.textMuted,
      fontStyle: "italic",
      marginTop: theme.space.xs,
    },
    jobLine: {
      ...theme.typography.caption,
      marginBottom: theme.space.sm,
      color: theme.colors.textMuted,
    },
    deidentifyChoices: {
      ...getCommonRow(),
      flexWrap: "wrap",
      gap: theme.space.sm,
      marginBottom: theme.space.lg,
    },
    deidentifyThumb: { width: 96, height: 96, borderRadius: theme.radius.md },
    thumbFallback: {
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: theme.colors.surfaceVariant,
    },
  };
});

export default EditPatternForm;
