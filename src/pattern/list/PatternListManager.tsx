import React, { useState } from "react";
import { Modal, ScrollView, Text, View } from "react-native";
import { SegmentedControl } from "@/src/common/ui";
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
import ModifierList from "@/src/pattern/list/ModifierList";
import EditModifierForm from "@/src/pattern/list/EditModifierForm";
import AppHeader from "@/src/common/components/AppHeader";
import PageContainer from "@/src/common/components/PageContainer";
import { getCommonListContainer } from "@/src/common/utils/CommonStyles";
import { useTranslation } from "react-i18next";
import { usePatternCrud } from "@/src/pattern/list/hooks/usePatternCrud";
import * as ImagePicker from "expo-image-picker";
import AppDialog from "@/src/common/components/AppDialog";
import { persistPickedVideos } from "@/src/pattern/data/videoFiles";
import DeidentifyModal, {
  DeidentifyTarget,
} from "@/src/deidentify/components/DeidentifyModal";
import DeidentifyJobsBanner from "@/src/deidentify/components/DeidentifyJobsBanner";
import { canShortenVideos } from "@/src/deidentify/shortenVideo";
import { DeidentifyJob, jobStore } from "@/src/deidentify/jobs/jobStore";
import { patternHasVideo } from "@/src/deidentify/jobs/replaceVideo";

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
  } = usePatternCrud();

  const [selectedPattern, setSelectedPattern] = useState<IPattern | undefined>(
    undefined,
  );
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<"patterns" | "modifiers">(
    "patterns",
  );
  const [isAddingModifier, setIsAddingModifier] = useState(false);
  const [isEditingModifier, setIsEditingModifier] = useState(false);
  const [selectedModifier, setSelectedModifier] = useState<
    IModifier | undefined
  >(undefined);
  // "From a video": the picked video seeds the add form, and once the pattern is saved the
  // user is offered to de-identify it (a background job that replaces the video when done).
  const [initialVideos, setInitialVideos] = useState<
    IVideoReference[] | undefined
  >(undefined);
  const [deidentifyOffer, setDeidentifyOffer] =
    useState<DeidentifyTarget | null>(null);
  const [cameraDenied, setCameraDenied] = useState(false);
  // A pattern to scroll to — set when a job line in the banner is tapped. `at` makes tapping
  // the same line twice scroll again.
  const [reveal, setReveal] = useState<{ id: number; at: number }>();
  const [deidentifyTarget, setDeidentifyTarget] =
    useState<DeidentifyTarget | null>(null);

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
    const seeded = initialVideos?.[0]?.value;
    setInitialVideos(undefined);
    if (
      activeList &&
      seeded &&
      pattern.videoRefs.some((v) => v.value === seeded) &&
      // Already being edited from inside the form — asking again would be redundant.
      !jobStore.getJobs().some((j) => j.sourceUri === seeded) &&
      canShortenVideos()
    ) {
      setDeidentifyOffer({
        listId: activeList.id,
        patternName: pattern.name,
        sourceUri: seeded,
      });
    }
    return accepted;
  };

  // The banner links a job to its pattern: by the video it produced once done, by the source
  // until then. Only in the active list — another list's patterns are not loaded here.
  const openJobPattern = (job: DeidentifyJob) => {
    if (activeList?.id !== job.listId) return undefined;
    const uri = job.resultUri ?? job.sourceUri;
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

  const handleSavePattern = async (pattern: NewPattern | IPattern) => {
    const accepted = await editPattern(pattern);
    if (accepted) setIsEditing(false);
    return accepted;
  };

  const handleDeletePattern = async (id?: number) => {
    if (await deletePattern(id)) {
      if (selectedPattern?.id === id) setSelectedPattern(undefined);
    }
  };

  const handleEditPattern = (pattern: IPattern) => {
    setSelectedPattern(pattern);
    setIsEditing(true);
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
        <Modal
          visible={isAddingNew}
          animationType="slide"
          transparent
          onRequestClose={closeAddForm}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
                <EditPatternForm
                  // Remount when a picked video seeds the form: it reads initialVideos once.
                  key={initialVideos?.[0]?.value ?? "new"}
                  patterns={patterns}
                  patternTypes={patternTypes}
                  modifiers={modifiers}
                  onAccepted={handleAddPattern}
                  onCancel={closeAddForm}
                  initialVideos={initialVideos}
                />
              </ScrollView>
            </View>
          </View>
        </Modal>
        <Modal
          visible={isEditing && selectedPattern != null}
          animationType="slide"
          transparent
          onRequestClose={() => setIsEditing(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
                <EditPatternForm
                  patterns={patterns}
                  patternTypes={patternTypes}
                  modifiers={modifiers}
                  onAccepted={handleSavePattern}
                  onCancel={() => setIsEditing(false)}
                  existing={selectedPattern}
                />
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Add / Edit Modifier modals */}
        <Modal
          visible={isAddingModifier}
          animationType="slide"
          transparent
          onRequestClose={() => setIsAddingModifier(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <EditModifierForm
                onAccepted={handleAddModifier}
                onCancel={() => setIsAddingModifier(false)}
              />
            </View>
          </View>
        </Modal>
        <Modal
          visible={isEditingModifier && selectedModifier != null}
          animationType="slide"
          transparent
          onRequestClose={() => setIsEditingModifier(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <EditModifierForm
                existing={selectedModifier}
                onAccepted={handleSaveModifier}
                onCancel={() => setIsEditingModifier(false)}
              />
            </View>
          </View>
        </Modal>

        <AppDialog
          visible={deidentifyOffer !== null}
          title={t("videoEditNowTitle")}
          message={t("videoEditNowMessage")}
          closeLabel={t("videoEditLater")}
          onClose={() => setDeidentifyOffer(null)}
          confirmLabel={t("videoEditNowYes")}
          onConfirm={() => {
            setDeidentifyTarget(deidentifyOffer);
            setDeidentifyOffer(null);
          }}
        />
        <AppDialog
          visible={cameraDenied}
          title={t("cameraPermissionDenied")}
          message={t("cameraPermissionDeniedHint")}
          onClose={() => setCameraDenied(false)}
        />
        <DeidentifyModal
          target={deidentifyTarget}
          onClose={() => setDeidentifyTarget(null)}
        />

        <DeidentifyJobsBanner openAction={openJobPattern} />

        {/* Tab strip */}
        <SegmentedControl
          segments={[
            { value: "patterns", label: t("patternList") },
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
              selectedPattern={selectedPattern}
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
  modalOverlay: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    borderRadius: theme.radius.none,
    padding: theme.space.xl,
    minWidth: "80%",
    maxHeight: "100%",
    ...theme.elevation.md,
    backgroundColor: theme.colors.surface,
  },
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
