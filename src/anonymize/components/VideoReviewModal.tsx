import React, { useState } from "react";
import { Modal, ScrollView, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { useVideoPlayer, VideoView } from "expo-video";
import { capVideoBuffer } from "@/src/common/utils/videoBuffer";
import { useTranslation } from "react-i18next";
import ModalOverlay from "@/src/common/components/ModalOverlay";
import { AppText, Button, IconButton, SwitchRow } from "@/src/common/ui";
import { formatSeconds } from "@/src/anonymize/model/trimWindow";
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
 * One filled button for the likely answer (replace), Keep both outlined, and the quiet answers
 * (discard, decide later) as text; tags under the video say what changed.
 *
 * Replacing keeps only the transcript lines inside the cut. When that would drop some, a switch
 * (on by default) puts the whole transcript into the description when replacing: an
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
  const [addTranscript, setAddTranscript] = useState(true);

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
  // Offered only where replacing would lose something said, and there is a description to keep it.
  const offerTranscript = kept < total && !!onDescriptionChange;
  const roomForBoth = groupSize < MAX_VIDEOS;

  const addFullTranscript = () => {
    if (!transcript || !onDescriptionChange) return;
    const all = new Set(transcript.segments.map((_, i) => i));
    const text = transcriptExcerpt(transcript.segments, all);
    onDescriptionChange((description) =>
      appendToDescription(description, text),
    );
  };
  const decide = (action: () => void | Promise<void>) => {
    player.pause();
    void action();
    onClose();
  };
  // The swap first, then the description: the swap writes the list as the mounted tree last
  // saw it, so a description written just before would be lost, while the edit after it puts
  // the recorded replacement into the pattern it saves (applyReplacements).
  const replace = () =>
    decide(async () => {
      await keep(job.id, "replace");
      if (offerTranscript && addTranscript) addFullTranscript();
    });

  // What changed, so the user knows what they are judging.
  const changes = [
    job.kind === "anonymize"
      ? t("videoBadgeSilhouette")
      : t("videoReviewShortened"),
    job.clip &&
      t("trimSelectionFree", {
        start: formatSeconds(job.clip.start),
        end: formatSeconds(job.clip.end),
        length: Math.round(job.clip.end - job.clip.start),
      }),
    job.kind === "anonymize"
      ? t("videoReviewNoSound")
      : t("videoReviewSoundKept"),
  ].filter((c): c is string => !!c);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.title}>
          <AppText variant="title" numberOfLines={1}>
            {t("videoReviewHeading")}
          </AppText>
          <AppText variant="bodySmall" color="textMuted" numberOfLines={1}>
            {job.patternName}
          </AppText>
        </View>
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
        <View style={styles.tags}>
          {changes.map((change) => (
            <View key={change} style={styles.tag}>
              <AppText variant="micro" color="onSurfaceVariant">
                {change}
              </AppText>
            </View>
          ))}
        </View>
        <AppText variant="bodySmall" color="textMuted">
          {t("videoReviewHint")}
        </AppText>
        {offerTranscript && (
          <SwitchRow
            title={t("videoReviewAddTranscript")}
            value={addTranscript}
            onValueChange={setAddTranscript}
          />
        )}
        <View style={styles.actions}>
          <Button title={t("videoReviewReplace")} onPress={replace} />
          <Button
            title={t("videoReviewKeepBoth")}
            variant="secondary"
            onPress={() => decide(() => keep(job.id, "both"))}
            disabled={!roomForBoth}
          />
          {!roomForBoth && (
            <AppText variant="caption" color="textMuted" style={styles.centred}>
              {t("videoReviewNoRoom", { max: MAX_VIDEOS })}
            </AppText>
          )}
          <View style={styles.quiet}>
            <Button
              title={t("videoReviewDiscard")}
              variant="dangerGhost"
              size="sm"
              onPress={() => decide(() => discard(job.id))}
            />
            <Button
              title={t("videoReviewLater")}
              variant="ghost"
              size="sm"
              onPress={onClose}
            />
          </View>
        </View>
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
        <View style={styles.actions}>
          {!empty && !job.errorKey && onApplySuggestion && (
            <Button title={t("suggestApply")} onPress={() => close(true)} />
          )}
          <View style={styles.quiet}>
            <Button
              title={t("suggestDismiss")}
              variant="dangerGhost"
              size="sm"
              onPress={() => close(false)}
            />
            <Button
              title={t("videoReviewLater")}
              variant="ghost"
              size="sm"
              onPress={onClose}
            />
          </View>
        </View>
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
  tags: { flexDirection: "row", flexWrap: "wrap", gap: theme.space.xs },
  tag: {
    paddingHorizontal: theme.space.sm,
    paddingVertical: theme.space.xxs,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surfaceVariant,
  },
  actions: { gap: theme.space.sm, marginTop: theme.space.sm },
  quiet: { flexDirection: "row", justifyContent: "space-between" },
  centred: { textAlign: "center" },
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
