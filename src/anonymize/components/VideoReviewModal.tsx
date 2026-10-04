import React, { useState } from "react";
import { Modal, ScrollView, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { useVideoPlayer, VideoView } from "expo-video";
import { capVideoBuffer } from "@/src/common/utils/videoBuffer";
import { useTranslation } from "react-i18next";
import ModalOverlay from "@/src/common/components/ModalOverlay";
import { AppText, Button, IconButton } from "@/src/common/ui";
import { SCREEN_EDGE_INSET } from "@/src/common/utils/EdgeInsets";
import {
  AnonymizeJob,
  useAnonymizeJobs,
} from "@/src/anonymize/jobs/AnonymizeJobsContext";
import { MAX_VIDEOS } from "@/src/anonymize/jobs/replaceVideo";
import { trimTranscript } from "@/src/pattern/data/transcripts";
import { usePatternCrud } from "@/src/pattern/list/hooks/usePatternCrud";
import { IVideoReference } from "@/src/pattern/types/IPatternList";
import {
  appendToDescription,
  transcriptExcerpt,
} from "@/src/transcribe/excerpt";
import { Suggestion } from "@/src/suggest/suggestPrompt";

/** Where the reviewed video's original sits, when the caller knows it better than the list. */
export type ReviewSource = {
  /** The original as it is now — its transcript decides what replacing would drop. */
  ref?: IVideoReference;
  /** How many videos its group holds; at [MAX_VIDEOS] there is no room to keep both. */
  groupSize: number;
  /** Appends to the description of the pattern the original belongs to. */
  onDescriptionChange?: (append: (description: string) => string) => void;
  /** Hands a suggestion to that pattern, which decides what it may fill. */
  onApplySuggestion?: (suggestion: Suggestion) => void;
};

type Props = {
  /** The job whose result to review; null hides the modal. */
  job: AnonymizeJob | null;
  onClose: () => void;
  /**
   * The original, from an edit form whose draft may differ from the saved pattern. Without it
   * the original is looked up in the active list's saved patterns.
   */
  source?: ReviewSource;
};

/**
 * Look at a shortened or anonymized video before it goes into the pattern, then put it in
 * place of the original, keep both, or throw it away. Closing leaves the decision for later;
 * the jobs banner keeps offering it.
 *
 * Replacing keeps only the transcript lines inside the cut. When that would drop some, the
 * sheet says so and offers to put the whole transcript into the description first: an
 * instructor often explains a figure at length and then shows it briefly, and the explanation
 * belongs in the description while only the showing is worth keeping as video.
 *
 * A transcribe-and-suggest job is reviewed here too: its suggested name and description, to use
 * or not. Using it never overwrites the user's text: a name only where there is none, and the
 * description as a paragraph of its own.
 */
const VideoReviewModal: React.FC<Props> = ({ job, onClose, source }) => {
  return (
    <Modal
      visible={job !== null}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <ModalOverlay align="bottom" padding="none">
        {job?.kind === "transcribe" && (
          <SuggestionCard
            key={job.id}
            job={job}
            onClose={onClose}
            source={source}
          />
        )}
        {job?.kind !== "transcribe" && job?.resultUri && (
          <ReviewCard
            key={job.id}
            job={job}
            resultUri={job.resultUri}
            onClose={onClose}
            source={source}
          />
        )}
      </ModalOverlay>
    </Modal>
  );
};

const ReviewCard: React.FC<{
  job: AnonymizeJob;
  resultUri: string;
  onClose: () => void;
  source?: ReviewSource;
}> = ({ job, resultUri, onClose, source }) => {
  const { t } = useTranslation();
  const { keep, discard } = useAnonymizeJobs();
  const fromList = useListSource(job.sourceUri);
  const { ref, groupSize, onDescriptionChange } = source ?? fromList;
  const [added, setAdded] = useState(false);

  const player = useVideoPlayer(resultUri, (p) => {
    capVideoBuffer(p);
    p.loop = true;
    p.play();
  });

  const transcript = ref?.transcript;
  const kept =
    transcript && job.clip
      ? trimTranscript(transcript, job.clip.start, job.clip.end).segments.length
      : 0;
  const total = transcript?.segments.length ?? 0;
  const dropsLines = kept < total;
  const roomForBoth = groupSize < MAX_VIDEOS;

  const addFullTranscript = () => {
    if (!transcript || !onDescriptionChange) return;
    const all = new Set(transcript.segments.map((_, i) => i));
    const text = transcriptExcerpt(transcript.segments, all);
    onDescriptionChange((description) =>
      appendToDescription(description, text),
    );
    setAdded(true);
  };
  const decide = (action: () => void | Promise<void>) => {
    player.pause();
    void action();
    onClose();
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <AppText variant="title" numberOfLines={1} style={styles.title}>
          {t("videoReviewTitle", { name: job.patternName })}
        </AppText>
        <IconButton
          icon="close"
          color="textMuted"
          onPress={onClose}
          accessibilityLabel={t("videoReviewLater")}
        />
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.preview}>
          <VideoView
            player={player}
            style={StyleSheet.absoluteFill}
            nativeControls
            contentFit="contain"
          />
        </View>
        <AppText variant="bodySmall" color="textMuted">
          {t("videoReviewHint")}
        </AppText>
        {dropsLines && (
          <View style={styles.note}>
            <AppText variant="bodySmall">
              {t("videoReviewDropsLines", { kept, total })}
            </AppText>
            {onDescriptionChange && (
              <Button
                title={
                  added
                    ? t("videoReviewTranscriptAdded")
                    : t("videoReviewAddTranscript")
                }
                icon={added ? "check" : "text-box-plus-outline"}
                variant="secondary"
                size="sm"
                onPress={addFullTranscript}
                disabled={added}
              />
            )}
          </View>
        )}
        <Button
          title={t("videoReviewReplace")}
          icon="swap-horizontal"
          onPress={() => decide(() => keep(job.id, "replace"))}
        />
        <Button
          title={t("videoReviewKeepBoth")}
          icon="plus-box-multiple-outline"
          variant="secondary"
          onPress={() => decide(() => keep(job.id, "both"))}
          disabled={!roomForBoth}
        />
        {!roomForBoth && (
          <AppText variant="bodySmall" color="textMuted">
            {t("videoReviewNoRoom", { max: MAX_VIDEOS })}
          </AppText>
        )}
        <Button
          title={t("videoReviewDiscard")}
          icon="delete-outline"
          variant="danger"
          onPress={() => decide(() => discard(job.id))}
        />
      </ScrollView>
    </View>
  );
};

const SuggestionCard: React.FC<{
  job: AnonymizeJob;
  onClose: () => void;
  source?: ReviewSource;
}> = ({ job, onClose, source }) => {
  const { t } = useTranslation();
  const { settle } = useAnonymizeJobs();
  const fromList = useListSource(job.sourceUri);
  const { onApplySuggestion } = source ?? fromList;
  const suggestion = job.suggestion;
  const empty = !suggestion || (!suggestion.name && !suggestion.description);

  const close = (apply: boolean) => {
    if (apply && suggestion) onApplySuggestion?.(suggestion);
    settle(job.id);
    onClose();
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <AppText variant="title" numberOfLines={1} style={styles.title}>
          {t("suggestReviewTitle", { name: job.patternName })}
        </AppText>
        <IconButton
          icon="close"
          color="textMuted"
          onPress={onClose}
          accessibilityLabel={t("videoReviewLater")}
        />
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        {job.errorKey ? (
          <AppText variant="bodySmall" color="danger">
            {t(job.errorKey)}
          </AppText>
        ) : empty ? (
          <AppText variant="bodySmall" color="textMuted">
            {t("suggestNothing")}
          </AppText>
        ) : (
          <View style={styles.note} testID="suggestion">
            {suggestion.name !== "" && (
              <AppText variant="label">
                {t("suggestName", { name: suggestion.name })}
              </AppText>
            )}
            {suggestion.description !== "" && (
              <AppText>{suggestion.description}</AppText>
            )}
            <AppText variant="caption" color="textMuted">
              {t("suggestApplyHint")}
            </AppText>
          </View>
        )}
        <AppText variant="bodySmall" color="textMuted">
          {t("suggestReviewTranscriptKept")}
        </AppText>
        {!empty && !job.errorKey && onApplySuggestion && (
          <Button
            title={t("suggestApply")}
            icon="check"
            onPress={() => close(true)}
          />
        )}
        <Button
          title={t("suggestDismiss")}
          variant="secondary"
          onPress={() => close(false)}
        />
      </ScrollView>
    </View>
  );
};

/** The original as the active list holds it, with the means to change its description. */
function useListSource(sourceUri: string): ReviewSource {
  const { patterns, editPattern, isReadonly } = usePatternCrud();
  for (const pattern of patterns) {
    const groups = [
      pattern.videoRefs,
      ...pattern.modifierRefs.map((m) => m.videoRefs),
    ];
    const group = groups.find((g) => g.some((v) => v.value === sourceUri));
    if (!group) continue;
    return {
      ref: group.find((v) => v.value === sourceUri),
      groupSize: group.length,
      onDescriptionChange: isReadonly
        ? undefined
        : (append) =>
            void editPattern({
              ...pattern,
              description: append(pattern.description ?? ""),
            }),
      onApplySuggestion: isReadonly
        ? undefined
        : (suggestion) =>
            void editPattern({
              ...pattern,
              name: pattern.name.trim() ? pattern.name : suggestion.name,
              description: appendToDescription(
                pattern.description ?? "",
                suggestion.description,
              ),
            }),
    };
  }
  // Not in a saved pattern here (another list, or a pattern not saved yet): keeping both is
  // still safe, since a full group never grows (see replaceVideoInPattern).
  return { groupSize: 0 };
}

const styles = StyleSheet.create((theme, rt) => ({
  card: {
    maxHeight: "92%",
    padding: theme.space.lg,
    paddingHorizontal: SCREEN_EDGE_INSET + theme.space.lg,
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
  title: { flex: 1 },
  body: { gap: theme.space.sm },
  preview: {
    width: "100%",
    aspectRatio: 16 / 9,
    maxHeight: 420,
    backgroundColor: theme.media.black,
  },
  note: {
    gap: theme.space.sm,
    padding: theme.space.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
  },
}));

export default VideoReviewModal;
