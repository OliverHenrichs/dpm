import React from "react";
import { Modal, ScrollView, Text, View } from "react-native";
import ModalOverlay from "@/src/common/components/ModalOverlay";
import { IconButton } from "@/src/common/ui";
import { StyleSheet } from "react-native-unistyles";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useTranslation } from "react-i18next";
import { SCREEN_EDGE_INSET } from "@/src/common/utils/EdgeInsets";
import VideoEditPanel from "@/src/deidentify/components/VideoEditPanel";
import { useDeidentifyJobs } from "@/src/deidentify/jobs/DeidentifyJobsContext";
import { ALL_PROVIDERS } from "@/src/deidentify/providers/allProviders";
import { availableProviders } from "@/src/deidentify/providers/registry";
import {
  IGeneratedVideo,
  IVideoTranscript,
} from "@/src/pattern/types/IPatternList";
import TranscribeSection from "@/src/transcribe/components/TranscribeSection";

export type DeidentifyTarget = {
  listId: string;
  /** For the progress line; the job finds the video by [sourceUri]. */
  patternName: string;
  sourceUri: string;
  /** Set when the video is already de-identified: it can then only be shortened. */
  generated?: IGeneratedVideo;
  /** What was said in it, when it has been transcribed (L4). */
  transcript?: IVideoTranscript;
};

type Props = {
  /** The video to edit; null hides the modal. */
  target: DeidentifyTarget | null;
  onClose: () => void;
  /** Opens the target's transcript; omitted where there is nowhere to show it. */
  onOpenTranscript?: (target: DeidentifyTarget) => void;
};

/**
 * Edit a pattern's video — shorten it, de-identify part of it, or transcribe what is said in
 * it. Each runs as a background job (de-identifying takes minutes), so this closes as soon as
 * one is started; the job replaces the video in the pattern, or annotates it, when done.
 */
const DeidentifyModal: React.FC<Props> = ({
  target,
  onClose,
  onOpenTranscript,
}) => {
  const { t } = useTranslation();
  const { start } = useDeidentifyJobs();

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
                  onShorten={(request) => {
                    start({
                      kind: "shorten",
                      listId: target.listId,
                      patternName: target.patternName,
                      request,
                      generated: target.generated,
                    });
                    onClose();
                  }}
                  onDeidentify={(provider, request) => {
                    start({
                      kind: "deidentify",
                      listId: target.listId,
                      patternName: target.patternName,
                      provider,
                      request,
                    });
                    onClose();
                  }}
                />
              )}
              {target && (
                <TranscribeSection
                  key={`speech-${target.sourceUri}`}
                  target={target}
                  onStarted={onClose}
                  onOpenTranscript={
                    onOpenTranscript && (() => onOpenTranscript(target))
                  }
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

export default DeidentifyModal;
