import React, { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Modal, Text, View } from "react-native";
import ModalOverlay from "@/src/common/components/ModalOverlay";
import { IconButton, SegmentedControl } from "@/src/common/ui";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import {
  IModifier,
  IPattern,
  IVideoReference,
  NewModifier,
  NewPattern,
} from "@/src/pattern/types/IPatternList";
import PatternList, { VideoSource } from "@/src/pattern/list/PatternList";
import EditPatternForm from "@/src/pattern/list/EditPatternForm";
import EditPatternModal, {
  PatternFormModal,
  usePatternEditing,
} from "@/src/pattern/list/EditPatternModal";
import ModifierList from "@/src/pattern/list/ModifierList";
import EditModifierForm from "@/src/pattern/list/EditModifierForm";
import PatternListTemplateModal from "@/src/pattern/list/PatternListTemplateModal";
import {
  countPatternsByLevel,
  countPatternsByType,
} from "@/src/pattern/list/typeMoves";
import AppHeader from "@/src/common/components/AppHeader";
import PageContainer from "@/src/common/components/PageContainer";
import {
  getCommonFormSheet,
  getCommonListContainer,
} from "@/src/common/utils/CommonStyles";
import { useTranslation } from "react-i18next";
import { usePatternCrud } from "@/src/pattern/list/hooks/usePatternCrud";
import * as ImagePicker from "expo-image-picker";
import AppDialog from "@/src/common/components/AppDialog";
import { persistPickedVideos } from "@/src/pattern/data/videoFiles";
import AnonymizeModal, {
  AnonymizeTarget,
} from "@/src/anonymize/components/AnonymizeModal";
import AnonymizeJobsBanner from "@/src/anonymize/components/AnonymizeJobsBanner";
import { canShortenVideos } from "@/src/anonymize/shortenVideo";
import { AnonymizeJob, jobStore } from "@/src/anonymize/jobs/jobStore";
import { patternHasVideo } from "@/src/anonymize/jobs/replaceVideo";
import { useActivePatternList } from "@/src/pattern/data/components/ActivePatternListContext";
import { firebaseAvailable } from "@/src/firebase/firebaseConfig";
import {
  canSuggestEditsTo,
  canSuggestTo,
  receivesSuggestions,
} from "@/src/pattern/suggestions/suggestions";
import { useListSuggestions } from "@/src/pattern/suggestions/useListSuggestions";
import SuggestionsButton from "@/src/pattern/suggestions/SuggestionsButton";
import SuggestPatternModal from "@/src/pattern/suggestions/SuggestPatternModal";
import SuggestionsModal from "@/src/pattern/suggestions/SuggestionsModal";
import { managesMembers } from "@/src/pattern/members/members";
import { useMembers } from "@/src/pattern/members/useMembers";
import MembersModal from "@/src/pattern/members/MembersModal";

const PatternListManager = () => {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const {
    activeList,
    patterns,
    patternTypes,
    modifiers,
    isReadonly,
    addPattern,
    editPattern,
    deletePattern,
    addModifier,
    editModifier,
    deleteModifier,
    addPatternType,
    saveList,
  } = usePatternCrud();
  // The list's own settings (types above all), opened from here so adding a type does not
  // mean leaving the list for the Lists screen (tester review 1).
  const [isEditingList, setIsEditingList] = useState(false);

  const [selectedPattern, setSelectedPattern] = useState<IPattern | undefined>(
    undefined,
  );
  const [isAddingNew, setIsAddingNew] = useState(false);
  // Editing a figure: shared with the Map's details (`EditPatternModal`).
  const { editing, startEditing, stopEditing } = usePatternEditing();
  const [activeTab, setActiveTab] = useState<"patterns" | "modifiers">(
    "patterns",
  );
  const [isAddingModifier, setIsAddingModifier] = useState(false);
  const [isEditingModifier, setIsEditingModifier] = useState(false);
  const [selectedModifier, setSelectedModifier] = useState<
    IModifier | undefined
  >(undefined);
  // "From a video": the picked video seeds the add form, and once the pattern is saved the
  // user is offered to anonymize it (a background job that replaces the video when done).
  const [initialVideos, setInitialVideos] = useState<
    IVideoReference[] | undefined
  >(undefined);
  const [anonymizeOffer, setAnonymizeOffer] = useState<AnonymizeTarget | null>(
    null,
  );
  const [cameraDenied, setCameraDenied] = useState(false);
  // A pattern to scroll to — set when a job line in the banner is tapped. `at` makes tapping
  // the same line twice scroll again.
  const [reveal, setReveal] = useState<{ id: number; at: number }>();
  const [anonymizeTarget, setAnonymizeTarget] =
    useState<AnonymizeTarget | null>(null);
  // Pattern suggestions (src/pattern/suggestions/): a subscriber sends them, the publisher
  // reviews them here.
  const [isSuggesting, setIsSuggesting] = useState(false);
  // A change to one figure, suggested from its row in Edit's place.
  const [suggestingEdit, setSuggestingEdit] = useState<IPattern | null>(null);
  const [isReviewingSuggestions, setIsReviewingSuggestions] = useState(false);
  const { suggestions } = useListSuggestions(activeList);
  const mayBeSuggestedTo = firebaseAvailable && canSuggestTo(activeList);
  const mayBeSuggestedEditsTo =
    firebaseAvailable && canSuggestEditsTo(activeList);
  const reviewsSuggestions =
    firebaseAvailable &&
    receivesSuggestions(activeList) &&
    (!!activeList?.suggestions || suggestions.length > 0);
  // Members-only lists (src/pattern/members/): the publisher lets subscribers in here.
  const [isManagingMembers, setIsManagingMembers] = useState(false);
  const { members } = useMembers(activeList);
  const showsMembers = firebaseAvailable && managesMembers(activeList);
  const waitingToJoin = members.filter(
    (m) => m.membership === "requested",
  ).length;

  // "New pattern" for a video shared to DPM from another app (src/videoLinks/): it arrives as
  // route params and seeds the add form like "From a video". The params are cleared once read,
  // so coming back to the tab does not open the form again.
  const { newVideo, newVideoType } = useLocalSearchParams<{
    newVideo?: string;
    newVideoType?: string;
  }>();
  // Read during render, as the form's state is adjusted to a prop; `seenVideo` keeps it to once.
  // Not before the list is loaded: whether it is read-only is not known until then.
  const { isLoading } = useActivePatternList();
  const [seenVideo, setSeenVideo] = useState<string>();
  if (!isLoading && newVideo !== seenVideo) {
    setSeenVideo(newVideo);
    if (newVideo && !isReadonly) {
      setInitialVideos([
        { type: newVideoType === "url" ? "url" : "local", value: newVideo },
      ]);
      setActiveTab("patterns");
      setIsAddingNew(true);
    }
  }
  useEffect(() => {
    if (newVideo && newVideo === seenVideo) {
      router.setParams({ newVideo: undefined, newVideoType: undefined });
    }
  }, [newVideo, seenVideo]);

  // The mutations live in usePatternCrud; what is left here is which modal is
  // open. Each returns whether it was applied, so a rejected edit — a blank
  // name, a read-only list — leaves the form open instead of silently
  // discarding what the user typed.
  // These return the outcome as well as acting on it: EditPatternForm keeps
  // what the user typed when the answer is `false`.
  const handleAddPattern = async (pattern: NewPattern) => {
    const accepted = await addPattern(pattern);
    if (!accepted) return accepted;
    setIsAddingNew(false);
    // Only a video on the phone can be edited; a shared link seeds the form too.
    const seeded =
      initialVideos?.[0]?.type === "local" ? initialVideos[0].value : undefined;
    setInitialVideos(undefined);
    if (
      activeList &&
      seeded &&
      pattern.videoRefs.some((v) => v.value === seeded) &&
      // Already being edited from inside the form — asking again would be redundant.
      !jobStore.getJobs().some((j) => j.sourceUri === seeded) &&
      canShortenVideos()
    ) {
      setAnonymizeOffer({
        listId: activeList.id,
        patternName: pattern.name,
        sourceUri: seeded,
      });
    }
    return accepted;
  };

  // The banner links a job to its pattern: by the video it produced once done, by the source
  // until then (a result waiting for review is not in the pattern yet). Only in the active
  // list — another list's patterns are not loaded here.
  const openJobPattern = (job: AnonymizeJob) => {
    if (activeList?.id !== job.listId) return undefined;
    const uri =
      job.status === "done" ? (job.resultUri ?? job.sourceUri) : job.sourceUri;
    const pattern = patterns.find((p) => patternHasVideo(p, uri));
    if (!pattern) return undefined;
    return () => {
      setActiveTab("patterns");
      setSelectedPattern(pattern);
      setReveal({ id: pattern.id, at: Date.now() });
    };
  };

  const closeAddForm = () => {
    setIsAddingNew(false);
    setInitialVideos(undefined);
  };

  const handleAddFromVideo = async (source: VideoSource) => {
    if (isReadonly) return;
    if (source === "camera") {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setCameraDenied(true);
        return;
      }
    }
    // The camera hands back the recording once it is stopped; it lands in the cache like a
    // library pick, and persistPickedVideos moves either into the app's documents.
    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ["videos"] })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["videos"],
            allowsMultipleSelection: false,
          });
    if (result.canceled || result.assets.length === 0) return;
    const [value] = await persistPickedVideos([result.assets[0].uri]);
    setInitialVideos([{ type: "local", value }]);
    setIsAddingNew(true);
  };

  const handleDeletePattern = async (id?: number) => {
    if (await deletePattern(id)) {
      if (selectedPattern?.id === id) setSelectedPattern(undefined);
    }
  };

  const handleEditPattern = (pattern: IPattern) => {
    setSelectedPattern(pattern);
    startEditing(pattern);
  };

  const handleAddModifier = async (modifier: NewModifier | IModifier) => {
    if (await addModifier(modifier)) setIsAddingModifier(false);
  };

  const handleSaveModifier = async (modifier: NewModifier | IModifier) => {
    if (await editModifier(modifier)) setIsEditingModifier(false);
  };

  const handleEditModifier = (modifier: IModifier) => {
    setSelectedModifier(modifier);
    setIsEditingModifier(true);
  };

  // Show empty state if no active list
  if (!activeList) {
    return (
      <View style={{ flex: 1 }}>
        <PageContainer style={{ backgroundColor: theme.colors.background }}>
          <AppHeader />
          <View style={styles.emptyStateContainer}>
            <Text style={styles.emptyStateText}>{t("noPatternLists")}</Text>
            <Text style={styles.emptyStateSubtext}>
              {t("noPatternListsHint")}
            </Text>
          </View>
        </PageContainer>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <PageContainer style={{ backgroundColor: theme.colors.background }}>
        <AppHeader />

        {/* Add / Edit Pattern modals */}
        <PatternFormModal visible={isAddingNew} onRequestClose={closeAddForm}>
          <EditPatternForm
            // Remount when a picked video seeds the form: it reads initialVideos once.
            key={initialVideos?.[0]?.value ?? "new"}
            patterns={patterns}
            patternTypes={patternTypes}
            modifiers={modifiers}
            onAccepted={handleAddPattern}
            onCancel={closeAddForm}
            onAddType={addPatternType}
            initialVideos={initialVideos}
          />
        </PatternFormModal>
        <EditPatternModal pattern={editing} onClose={stopEditing} />

        {/* Add / Edit Modifier modals */}
        <Modal
          visible={isAddingModifier}
          animationType="slide"
          transparent
          onRequestClose={() => setIsAddingModifier(false)}
        >
          <ModalOverlay padding="none">
            <View style={styles.modalContent}>
              <EditModifierForm
                onAccepted={handleAddModifier}
                onCancel={() => setIsAddingModifier(false)}
              />
            </View>
          </ModalOverlay>
        </Modal>
        <Modal
          visible={isEditingModifier && selectedModifier != null}
          animationType="slide"
          transparent
          onRequestClose={() => setIsEditingModifier(false)}
        >
          <ModalOverlay padding="none">
            <View style={styles.modalContent}>
              <EditModifierForm
                existing={selectedModifier}
                onAccepted={handleSaveModifier}
                onCancel={() => setIsEditingModifier(false)}
              />
            </View>
          </ModalOverlay>
        </Modal>

        <AppDialog
          visible={anonymizeOffer !== null}
          title={t("videoEditNowTitle")}
          message={t("videoEditNowMessage")}
          closeLabel={t("videoEditLater")}
          onClose={() => setAnonymizeOffer(null)}
          confirmLabel={t("videoEditNowYes")}
          onConfirm={() => {
            setAnonymizeTarget(anonymizeOffer);
            setAnonymizeOffer(null);
          }}
        />
        <AppDialog
          visible={cameraDenied}
          title={t("cameraPermissionDenied")}
          message={t("cameraPermissionDeniedHint")}
          onClose={() => setCameraDenied(false)}
        />
        <AnonymizeModal
          target={anonymizeTarget}
          onClose={() => setAnonymizeTarget(null)}
        />

        {mayBeSuggestedTo && (
          <SuggestPatternModal
            visible={isSuggesting || suggestingEdit !== null}
            list={activeList}
            patterns={patterns}
            patternTypes={patternTypes}
            modifiers={modifiers}
            editing={suggestingEdit ?? undefined}
            onClose={() => {
              setIsSuggesting(false);
              setSuggestingEdit(null);
            }}
          />
        )}
        {reviewsSuggestions && (
          <SuggestionsModal
            visible={isReviewingSuggestions}
            list={activeList}
            patterns={patterns}
            patternTypes={patternTypes}
            modifiers={modifiers}
            suggestions={suggestions}
            onClose={() => setIsReviewingSuggestions(false)}
            onAccept={addPattern}
            onApplyEdit={editPattern}
          />
        )}

        {showsMembers && activeList && (
          <MembersModal
            visible={isManagingMembers}
            list={activeList}
            members={members}
            onClose={() => setIsManagingMembers(false)}
          />
        )}

        {activeList && !isReadonly && (
          <PatternListTemplateModal
            visible={isEditingList}
            onClose={() => setIsEditingList(false)}
            editList={activeList}
            typeUsage={countPatternsByType(patterns)}
            levelUsage={countPatternsByLevel(patterns)}
            onSaveList={async (list, typeMoves, levelMoves) => {
              await saveList(list, typeMoves, levelMoves);
              setIsEditingList(false);
            }}
          />
        )}

        <AnonymizeJobsBanner openAction={openJobPattern} />

        {/* Tab strip */}
        <SegmentedControl
          segments={[
            {
              value: "patterns",
              label: t("patternList"),
              count: patterns.length,
            },
            {
              value: "modifiers",
              label: t("modifiersTab"),
              count: modifiers.length,
            },
          ]}
          value={activeTab}
          onChange={setActiveTab}
          style={styles.tabStrip}
        />

        <View style={styles.contentContainer}>
          {activeTab === "patterns" ? (
            <PatternList
              patterns={patterns}
              patternTypes={patternTypes}
              modifiers={modifiers}
              isReadonly={isReadonly}
              onSelect={(p) => setSelectedPattern(p as IPattern | undefined)}
              onDelete={handleDeletePattern}
              onAdd={() => setIsAddingNew(!isAddingNew)}
              onAddFromVideo={handleAddFromVideo}
              reveal={reveal}
              onEdit={handleEditPattern}
              onSuggestEdit={
                mayBeSuggestedEditsTo ? setSuggestingEdit : undefined
              }
              selectedPattern={selectedPattern}
              headerActions={
                <>
                  {!isReadonly && (
                    <IconButton
                      icon="shape-outline"
                      onPress={() => setIsEditingList(true)}
                      accessibilityLabel={t("editTypes")}
                    />
                  )}
                  {showsMembers && (
                    <SuggestionsButton
                      icon="account-group-outline"
                      activeIcon="account-group"
                      onPress={() => setIsManagingMembers(true)}
                      accessibilityLabel={t("membersButtonLabel", {
                        count: waitingToJoin,
                      })}
                      count={waitingToJoin}
                    />
                  )}
                  {mayBeSuggestedTo ? (
                    <SuggestionsButton
                      onPress={() => setIsSuggesting(true)}
                      accessibilityLabel={t("suggestPattern")}
                    />
                  ) : reviewsSuggestions ? (
                    <SuggestionsButton
                      onPress={() => setIsReviewingSuggestions(true)}
                      accessibilityLabel={t("suggestionsReviewLabel", {
                        count: suggestions.length,
                      })}
                      count={suggestions.length}
                    />
                  ) : null}
                </>
              }
            />
          ) : (
            <ModifierList
              modifiers={modifiers}
              patterns={patterns}
              patternTypes={patternTypes}
              isReadonly={isReadonly}
              onAdd={() => setIsAddingModifier(true)}
              onEdit={handleEditModifier}
              onDelete={deleteModifier}
            />
          )}
        </View>
      </PageContainer>
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
  contentContainer: {
    ...getCommonListContainer(theme),
    flex: 1,
  },
  tabStrip: {
    marginHorizontal: theme.space.sm,
    marginBottom: theme.space.sm,
  },
  modalContent: getCommonFormSheet(theme),
  emptyStateContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: theme.space.xxxl,
  },
  emptyStateText: {
    ...theme.typography.title,
    fontWeight: "600",
    color: theme.colors.textMuted,
    marginBottom: theme.space.sm,
    textAlign: "center",
  },
  emptyStateSubtext: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
    textAlign: "center",
  },
}));

export default PatternListManager;
