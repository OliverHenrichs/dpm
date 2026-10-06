import React, { useEffect, useMemo, useState } from "react";
import { Image, ScrollView, Text, TextInput, View } from "react-native";
import { Button, Chip, ListRow, Tappable } from "@/src/common/ui";
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
import {
  appendRhythmStep,
  lastRhythmStep,
  nextRhythmSteps,
  normalizeRhythm,
  rhythmCounts,
  rhythmMatchesCounts,
  removeLastRhythmStep,
  rhythmSuggestions,
} from "@/src/pattern/rhythm/rhythm";
import AppDialog from "@/src/common/components/AppDialog";
import AnonymizeModal, {
  AnonymizeTarget,
} from "@/src/anonymize/components/AnonymizeModal";
import VideoReviewModal, {
  ReviewSource,
} from "@/src/anonymize/components/VideoReviewModal";
import { useAnonymizeJobs } from "@/src/anonymize/jobs/AnonymizeJobsContext";
import {
  applyReplacements,
  MAX_VIDEOS,
} from "@/src/anonymize/jobs/replaceVideo";
import { jobStore } from "@/src/anonymize/jobs/jobStore";
import { canShortenVideos } from "@/src/anonymize/shortenVideo";
import TranscriptSheet, {
  TranscriptTarget,
} from "@/src/transcribe/components/TranscriptSheet";
import { useStartTranscription } from "@/src/transcribe/hooks/useStartTranscription";
import { appendToDescription } from "@/src/transcribe/excerpt";
import { Suggestion } from "@/src/suggest/suggestPrompt";
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
    // No level: it matters for courses, and a pattern without one simply shows none.
    prerequisites: [],
    description: "",
    tags: [],
    videoRefs: initialVideos ?? [],
    modifierRefs: [],
  });

  const [newPattern, setNewPattern] = useState<NewPattern>(
    existing ?? createDefaultPattern(),
  );
  // What is typed in the rhythm field. The pattern carries it only once it is a rhythm, and
  // then its counts follow it; until then the field says what is wrong.
  const [rhythmDraft, setRhythmDraft] = useState(existing?.rhythm ?? "");
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [prereqFilter, setPrereqFilter] = useState<string>("");
  const [showAddVideoModal, setShowAddVideoModal] = useState(false);
  const [selectedModifierId, setSelectedModifierId] = useState<string | null>(
    null,
  );
  const [showAttachPicker, setShowAttachPicker] = useState(false);
  const [showAnonymizePicker, setShowAnonymizePicker] = useState(false);
  const [anonymizeTarget, setAnonymizeTarget] =
    useState<AnonymizeTarget | null>(null);
  const [transcriptTarget, setTranscriptTarget] =
    useState<TranscriptTarget | null>(null);
  const { activeList } = useActivePatternList();
  const { jobs } = useAnonymizeJobs();
  const startTranscription = useStartTranscription();

  // An anonymization job that finishes while this form is open replaced the video in the
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

  // Keyed by the videos themselves, not the draft's objects: the draft is rebuilt for reasons
  // that leave the videos as they were (a transcript, a job's progress).
  const activeVideoKey = activeVideoRefs
    .map((ref) => `${ref.type}:${ref.value}`)
    .join("\n");
  useEffect(() => {
    let cancelled = false;
    generateVideoThumbnails(activeVideoRefs).then((uris) => {
      if (!cancelled) setThumbnails(uris);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeVideoKey]);

  const handleFinish = async () => {
    // Only clear the form once the caller has taken the pattern. It used to
    // reset unconditionally, which quietly destroyed an edit the caller had
    // refused: a blank name leaves the modal open, so the user was left
    // looking at an empty "Edit Pattern" form with the pattern's type, counts,
    // videos and — fatally — its id all gone. Saving again then failed with
    // "Cannot edit pattern without id", so the form could not be escaped
    // except by cancelling.
    const accepted = await onAccepted(newPattern);
    if (accepted !== false) {
      setNewPattern(createDefaultPattern());
      setRhythmDraft("");
    }
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

  // Editing a video (shorten, anonymize): one of this draft's own local videos, or one
  // picked from the gallery (added to the draft first). The run is a background job; see
  // src/anonymize/jobs/jobStore.ts.
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

  // Never over the user's own text: a name only where there is none, and the description as a
  // paragraph of its own.
  const applySuggestion = (suggestion: Suggestion) =>
    setNewPattern((prev) => ({
      ...prev,
      name: prev.name.trim() ? prev.name : suggestion.name,
      description: appendToDescription(
        prev.description ?? "",
        suggestion.description,
      ),
    }));

  // A finished video waiting to be checked, opened from its line below the videos.
  const [reviewId, setReviewId] = useState<string | null>(null);
  const reviewing =
    draftJobs.find((j) => j.id === reviewId && j.status === "review") ?? null;
  // The original as this draft holds it — it may not be saved yet.
  const reviewSource = ((): ReviewSource | undefined => {
    if (!reviewing) return undefined;
    const groups = [
      newPattern.videoRefs ?? [],
      ...(newPattern.modifierRefs ?? []).map((m) => m.videoRefs),
    ];
    const group = groups.find((g) =>
      g.some((v) => v.value === reviewing.sourceUri),
    );
    return {
      ref: group?.find((v) => v.value === reviewing.sourceUri),
      groupSize: group?.length ?? 0,
      onDescriptionChange: (append) =>
        setNewPattern((prev) => ({
          ...prev,
          description: append(prev.description ?? ""),
        })),
      onApplySuggestion: applySuggestion,
    };
  })();
  // Edit was pressed with no video on the phone to edit and no room to pick one.
  const [editBlocked, setEditBlocked] = useState(false);
  const onlineVideos = activeVideoRefs.length - editable.length;

  const openEditor = (ref: IVideoReference) => {
    if (!activeList) return;
    setShowAnonymizePicker(false);
    setAnonymizeTarget({
      listId: activeList.id,
      patternName: newPattern.name.trim() || t("addPatternNew"),
      sourceUri: ref.value,
      ...(ref.generated && { generated: ref.generated }),
      ...(ref.transcript && { transcript: ref.transcript }),
    });
  };

  // What was said in a video (L4): opened from its thumbnail, or from Edit video.
  const openTranscript = (ref: IVideoReference) => {
    if (!activeList || !ref.transcript) return;
    setAnonymizeTarget(null);
    setTranscriptTarget({
      listId: activeList.id,
      patternName: newPattern.name.trim() || t("addPatternNew"),
      sourceUri: ref.value,
      transcript: ref.transcript,
      hasSound: !ref.generated,
    });
  };

  const pickForAnonymize = async () => {
    if (activeVideoRefs.length >= 3) return;
    setShowAnonymizePicker(false);
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
    if (editable.length === 1) openEditor(editable[0].ref);
    else if (editable.length > 1) setShowAnonymizePicker(true);
    else if (activeVideoRefs.length >= MAX_VIDEOS) setEditBlocked(true);
    else void pickForAnonymize();
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

  // Counts and rhythm stay matched both ways. New counts drop a rhythm that no longer fits
  // (the suggestions below offer ones that do); a rhythm sets the counts it takes. The key goes
  // rather than holding `undefined`, which Firestore rejects when the list is published.
  const changeCounts = (counts: number) => {
    const { rhythm, ...rest } = newPattern;
    if (rhythm && !rhythmMatchesCounts(rhythm, counts)) {
      setNewPattern({ ...rest, counts });
      setRhythmDraft("");
    } else {
      setNewPattern({ ...newPattern, counts });
    }
  };

  const changeRhythm = (text: string) => {
    setRhythmDraft(text);
    const { rhythm: _previous, ...rest } = newPattern;
    const counts = rhythmCounts(text);
    setNewPattern(
      counts === null
        ? rest
        : { ...rest, counts, rhythm: normalizeRhythm(text) },
    );
  };

  const rhythmInvalid =
    rhythmDraft.trim().length > 0 && rhythmCounts(rhythmDraft) === null;
  // Whole rhythms for the counts while the field is empty; the next steps to tap on as soon
  // as there is something to go on from.
  const suggestedRhythms = rhythmDraft.trim()
    ? []
    : rhythmSuggestions(activeList?.dance, newPattern.counts);
  const nextSteps = nextRhythmSteps(rhythmDraft);
  // The last step, for the undo chip beside the next steps: a mistap is fixed without the
  // keyboard. Offered for any text, so a typed rhythm that went wrong can be backed out too.
  const lastStep = lastRhythmStep(rhythmDraft);

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
            onChangeText={(text) => changeCounts(parseInt(text) || 0)}
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
              label={t(level)}
              selected={newPattern.level === level}
              accessibilityHint={
                newPattern.level === level ? t("levelClearHint") : undefined
              }
              onPress={() => {
                // Tapping the chosen level clears it. The key goes, rather than holding
                // `undefined`, which Firestore rejects when the list is published.
                const { level: current, ...rest } = newPattern;
                setNewPattern(current === level ? rest : { ...rest, level });
              }}
            />
          ))}
        </View>
      </View>
      <View style={styles.rhythmBlock}>
        <Text style={styles.label}>{t("rhythm")}</Text>
        <TextInput
          placeholder={t("rhythmPlaceholder")}
          value={rhythmDraft}
          onChangeText={changeRhythm}
          accessibilityLabel={t("rhythm")}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.rhythmInput}
          placeholderTextColor={theme.colors.textMuted}
        />
        {rhythmInvalid && (
          <Text style={styles.rhythmError}>{t("rhythmInvalid")}</Text>
        )}
        {suggestedRhythms.length > 0 && (
          <View style={styles.rhythmSuggestions}>
            {suggestedRhythms.map((rhythm) => (
              <Chip
                key={rhythm}
                label={rhythm}
                icon="music-note-outline"
                accessibilityHint={t("rhythmSuggestionHint")}
                onPress={() => changeRhythm(rhythm)}
              />
            ))}
          </View>
        )}
        {(nextSteps.length > 0 || lastStep) && (
          <View style={styles.rhythmSuggestions}>
            {nextSteps.map((step) => (
              <Chip
                key={step}
                label={step}
                icon="plus"
                accessibilityLabel={t("rhythmAddStep", { step })}
                onPress={() =>
                  changeRhythm(appendRhythmStep(rhythmDraft, step))
                }
              />
            ))}
            {lastStep && (
              <Chip
                label={t("rhythmUndoStep")}
                icon="backspace-outline"
                accessibilityLabel={t("rhythmRemoveStep", { step: lastStep })}
                onPress={() => changeRhythm(removeLastRhythmStep(rhythmDraft))}
              />
            )}
          </View>
        )}
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
        onEditVideoAt={
          canEditVideos
            ? (index) => openEditor(activeVideoRefs[index])
            : undefined
        }
        onOpenTranscript={(index) => openTranscript(activeVideoRefs[index])}
        disabled={isActiveVideoReadonly || activeVideoRefs.length >= MAX_VIDEOS}
        full={!isActiveVideoReadonly && activeVideoRefs.length >= MAX_VIDEOS}
      />
      {draftJobs.map((job) =>
        job.status === "review" ? (
          <View key={job.id} style={styles.jobRow}>
            <Text style={[styles.jobLine, styles.jobRowText]}>
              {job.kind === "transcribe"
                ? t("suggestJobInFormReview")
                : t("videoJobInFormReview")}
            </Text>
            <Button
              title={t("videoJobReviewButton")}
              size="sm"
              onPress={() => setReviewId(job.id)}
            />
          </View>
        ) : (
          // Each line names its kind: a transcription that failed for want of sound sat above
          // a cut still running, and "processing" for both read as one job failing and going on.
          <Text
            key={job.id}
            style={[
              styles.jobLine,
              job.status === "failed" && styles.jobLineFailed,
            ]}
          >
            {job.status === "queued"
              ? t(`${job.kind}JobInFormQueued`)
              : job.status === "running"
                ? t(`${job.kind}JobInFormRunning`, {
                    percent: Math.round(job.progress * 100),
                  })
                : t(`${job.kind}JobInFormFailed`, {
                    error: job.errorKey ? t(job.errorKey) : (job.error ?? ""),
                  })}
          </Text>
        ),
      )}
      {draftJobs.some(
        (j) => j.status === "queued" || j.status === "running",
      ) && <Text style={styles.jobLine}>{t("videoJobsKeepOpen")}</Text>}
      <VideoReviewModal
        job={reviewing}
        onClose={() => setReviewId(null)}
        source={reviewSource}
      />
      <AppDialog
        visible={editBlocked}
        title={t("videoEditTitle")}
        message={t("videoEditOnlyLocal", { max: MAX_VIDEOS })}
        onClose={() => setEditBlocked(false)}
      />
      <BottomSheet
        visible={showAnonymizePicker}
        onClose={() => setShowAnonymizePicker(false)}
        title={t("anonymizeChooseVideo")}
        minHeight="25%"
        maxHeight="50%"
      >
        {onlineVideos > 0 && (
          <Text style={styles.jobLine}>{t("videoEditOnlineHint")}</Text>
        )}
        <View style={styles.anonymizeChoices}>
          {editable.map(({ ref, index }) => (
            <Tappable
              key={ref.value}
              onPress={() => openEditor(ref)}
              accessibilityLabel={t("anonymizeVideoN", { n: index + 1 })}
              style={styles.anonymizeThumbButton}
            >
              {thumbnails[index] ? (
                <Image
                  source={{ uri: thumbnails[index] }}
                  style={styles.anonymizeThumb}
                />
              ) : (
                <View style={[styles.anonymizeThumb, styles.thumbFallback]}>
                  <Text style={styles.buttonText}>{index + 1}</Text>
                </View>
              )}
            </Tappable>
          ))}
        </View>
        <Button
          title={t("anonymizeFromGallery")}
          icon="image-plus"
          variant="secondary"
          onPress={pickForAnonymize}
          disabled={activeVideoRefs.length >= 3}
        />
      </BottomSheet>
      <AnonymizeModal
        target={anonymizeTarget}
        onClose={() => setAnonymizeTarget(null)}
      />
      <TranscriptSheet
        target={transcriptTarget}
        onClose={() => setTranscriptTarget(null)}
        onDescriptionChange={(append) =>
          setNewPattern((prev) => ({
            ...prev,
            description: append(prev.description ?? ""),
          }))
        }
        onApplySuggestion={applySuggestion}
        onRetranscribe={
          canEditVideos && transcriptTarget
            ? (language) => startTranscription(transcriptTarget, language)
            : undefined
        }
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
    rhythmBlock: { marginBottom: theme.space.sm },
    rhythmInput: { ...baseInput },
    rhythmError: {
      ...theme.typography.caption,
      color: theme.colors.danger,
      marginTop: theme.space.xxs,
    },
    rhythmSuggestions: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.space.xs,
      marginTop: theme.space.xs,
    },
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
      ...theme.typography.label,
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
    jobLineFailed: { color: theme.colors.danger },
    jobRow: {
      ...getCommonRow(),
      gap: theme.space.sm,
      marginBottom: theme.space.sm,
    },
    jobRowText: { flex: 1, marginBottom: 0 },
    anonymizeChoices: {
      ...getCommonRow(),
      flexWrap: "wrap",
      gap: theme.space.sm,
      marginBottom: theme.space.lg,
    },
    anonymizeThumbButton: {
      overflow: "hidden",
      borderRadius: theme.radius.md,
    },
    anonymizeThumb: { width: 96, height: 96, borderRadius: theme.radius.md },
    thumbFallback: {
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: theme.colors.surfaceVariant,
    },
  };
});

export default EditPatternForm;
