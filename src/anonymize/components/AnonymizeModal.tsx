import React, { useState } from "react";
import { Modal, ScrollView, Text, View } from "react-native";
import ModalOverlay from "@/src/common/components/ModalOverlay";
import { IconButton, SwitchRow } from "@/src/common/ui";
import { StyleSheet } from "react-native-unistyles";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useTranslation } from "react-i18next";
import { SCREEN_EDGE_INSET } from "@/src/common/utils/EdgeInsets";
import VideoEditPanel from "@/src/anonymize/components/VideoEditPanel";
import { useAnonymizeJobs } from "@/src/anonymize/jobs/AnonymizeJobsContext";
import { ALL_PROVIDERS } from "@/src/anonymize/providers/allProviders";
import { availableProviders } from "@/src/anonymize/providers/registry";
import {
  IGeneratedVideo,
  IVideoTranscript,
} from "@/src/pattern/types/IPatternList";
import TranscribeSection from "@/src/transcribe/components/TranscribeSection";
import { isAudioExtractAvailable } from "@/modules/audio-extract";
import { useStartTranscription } from "@/src/transcribe/hooks/useStartTranscription";
import { installedModels } from "@/src/transcribe/modelStore";
import { TRANSCRIPTION_DOWNLOAD_MB } from "@/src/transcribe/models";

export type AnonymizeTarget = {
  listId: string;
  /** For the progress line; the job finds the video by [sourceUri]. */
  patternName: string;
  sourceUri: string;
  /** Set when the video is already anonymized: it can then only be shortened. */
  generated?: IGeneratedVideo;
  /** What was said in it, when it has been transcribed (L4). */
  transcript?: IVideoTranscript;
};

type Props = {
  /** The video to edit; null hides the modal. */
  target: AnonymizeTarget | null;
  onClose: () => void;
};

/**
 * Edit a pattern's video — shorten it, anonymize part of it, or transcribe what is said in
 * it, one tab each (`VideoEditPanel`). Each runs as a background job (anonymizing takes
 * minutes), so this closes as soon as one is started. A transcript lands on the video when
 * done; a shortened or anonymized video waits for the user to review it (`VideoReviewModal`).
 *
 * Cutting a video that has sound and no transcript offers to transcribe the whole of it first
 * (a switch above either cut's button), on by default: a silhouette has no sound to transcribe
 * later, and an instructor's explanation is usually longer than the part worth keeping. The
 * jobs run in turn, so the transcript is on the original before the cut is reviewed.
 */
const AnonymizeModal: React.FC<Props> = ({ target, onClose }) => {
  const { t } = useTranslation();
  const { start } = useAnonymizeJobs();
  const startTranscription = useStartTranscription();
  const [transcribeFirst, setTranscribeFirst] = useState(true);
  const offerTranscribeFirst =
    isAudioExtractAvailable &&
    !!target &&
    !target.generated &&
    !target.transcript;
  // Queued ahead of the cut, so it runs first.
  const maybeTranscribeFirst = () => {
    if (target && offerTranscribeFirst && transcribeFirst) {
      startTranscription(target);
    }
  };

  return (
    <Modal
      visible={target !== null}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      {/* A Modal renders outside the drawer's gesture root, and without one of its own the
          trim bar's pan never activates on Android. See src/pattern/graph/AGENTS.md. */}
      <GestureHandlerRootView style={styles.root}>
        <ModalOverlay align="bottom" padding="none">
          <View style={styles.card}>
            <View style={styles.header}>
              <Text style={styles.title} numberOfLines={1}>
                {t("videoEditTitle")}
                {target ? ` — ${target.patternName}` : ""}
              </Text>
              <IconButton
                icon="close"
                color="textMuted"
                onPress={onClose}
                accessibilityLabel={t("close")}
              />
            </View>
            <ScrollView>
              {target && (
                <VideoEditPanel
                  key={target.sourceUri}
                  sourceUri={target.sourceUri}
                  providers={
                    target.generated ? [] : availableProviders(ALL_PROVIDERS)
                  }
                  cutOptions={(cut) =>
                    offerTranscribeFirst && (
                      <SwitchRow
                        title={t("videoTranscribeFirst")}
                        description={[
                          cut === "anonymize"
                            ? t("videoTranscribeFirstAnonymize")
                            : t("videoTranscribeFirstShorten"),
                          !installedModels() &&
                            t("modelDownloadOnce", {
                              size: TRANSCRIPTION_DOWNLOAD_MB,
                            }),
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        value={transcribeFirst}
                        onValueChange={setTranscribeFirst}
                      />
                    )
                  }
                  speech={
                    isAudioExtractAvailable
                      ? (playback) => (
                          <TranscribeSection
                            target={target}
                            onStarted={onClose}
                            playback={playback}
                          />
                        )
                      : undefined
                  }
                  onShorten={(request) => {
                    maybeTranscribeFirst();
                    start({
                      kind: "shorten",
                      listId: target.listId,
                      patternName: target.patternName,
                      request,
                      generated: target.generated,
                    });
                    onClose();
                  }}
                  onAnonymize={(provider, request) => {
                    maybeTranscribeFirst();
                    start({
                      kind: "anonymize",
                      listId: target.listId,
                      patternName: target.patternName,
                      provider,
                      request,
                    });
                    onClose();
                  }}
                />
              )}
            </ScrollView>
          </View>
        </ModalOverlay>
      </GestureHandlerRootView>
    </Modal>
  );
};

const styles = StyleSheet.create((theme, rt) => ({
  root: { flex: 1 },
  card: {
    maxHeight: "92%",
    padding: theme.space.lg,
    // The trim bar is dragged sideways: keep it out of Android's back-gesture band, which a
    // full-width sheet does not do on its own (it is not inside PageContainer).
    paddingHorizontal: SCREEN_EDGE_INSET + theme.space.lg,
    // Runs to the screen's bottom edge: its content keeps clear of the gesture bar.
    paddingBottom: theme.space.lg + rt.insets.bottom,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: theme.space.md,
    gap: theme.space.sm,
  },
  title: {
    ...theme.typography.title,
    flex: 1,
    color: theme.colors.text,
  },
}));

export default AnonymizeModal;
