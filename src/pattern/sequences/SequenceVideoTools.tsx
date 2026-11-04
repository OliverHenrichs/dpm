import React, { useState } from "react";
import { View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import { Button, IconButton } from "@/src/common/ui";
import AppDialog from "@/src/common/components/AppDialog";
import {
  ISequence,
  IVideoReference,
  IVideoTranscript,
} from "@/src/pattern/types/IPatternList";
import { useActivePatternList } from "@/src/pattern/data/components/ActivePatternListContext";
import AnonymizeModal, {
  AnonymizeTarget,
} from "@/src/anonymize/components/AnonymizeModal";
import VideoReviewModal, {
  ReviewSource,
} from "@/src/anonymize/components/VideoReviewModal";
import DraftJobLines from "@/src/anonymize/components/DraftJobLines";
import { useAnonymizeJobs } from "@/src/anonymize/jobs/AnonymizeJobsContext";
import { canShortenVideos } from "@/src/anonymize/shortenVideo";
import TranscriptSheet, {
  TranscriptTarget,
} from "@/src/transcribe/components/TranscriptSheet";
import { useStartTranscription } from "@/src/transcribe/hooks/useStartTranscription";
import { rememberTranscriptEdit } from "@/src/transcribe/data/CorrectionStorage";
import { appendToDescription } from "@/src/transcribe/excerpt";
import PutOnlineSheet, {
  PutOnlineTarget,
} from "@/src/videoLinks/components/PutOnlineSheet";
import { Suggestion } from "@/src/suggest/suggestPrompt";

interface Props {
  /** The draft's video. */
  video: IVideoReference;
  /** The draft's name, for the jobs' lines. */
  name: string;
  setDraft: React.Dispatch<React.SetStateAction<ISequence>>;
  /** Called before a sheet with a player of its own opens: the form's player pauses. */
  onOpen: () => void;
}

/**
 * The figure form's video tools, for a sequence's one video: _Edit video_ (Shorten, Anonymize,
 * Speech in `AnonymizeModal`), its transcript (`TranscriptSheet`, corrected and transcribed
 * again here), _Put online_, and the lines of the jobs on it with their review. The jobs are the
 * figures' (`src/anonymize/`): they find the video by URI wherever the list holds it, and the
 * form takes a finished one through `applySequenceReplacements`, marks moved to a cut. What
 * changes the draft (a corrected line, text for the description) stays in it until Save, as in
 * the figure form. Android only, gated as there (`canShortenVideos`).
 */
const SequenceVideoTools: React.FC<Props> = ({
  video,
  name,
  setDraft,
  onOpen,
}) => {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const { activeList } = useActivePatternList();
  const { jobs } = useAnonymizeJobs();
  const startTranscription = useStartTranscription();
  const [anonymizeTarget, setAnonymizeTarget] =
    useState<AnonymizeTarget | null>(null);
  const [transcriptTarget, setTranscriptTarget] =
    useState<TranscriptTarget | null>(null);
  const [putOnlineTarget, setPutOnlineTarget] =
    useState<PutOnlineTarget | null>(null);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [editBlocked, setEditBlocked] = useState(false);

  const writable = !!activeList && !activeList.readonly;
  const canEditVideos = writable && canShortenVideos();
  const local = video.type === "local";
  const label = name.trim() || t("sequenceNew");

  const draftJobs = jobs.filter(
    (j) => j.sourceUri === video.value && j.status !== "done",
  );
  const reviewing =
    draftJobs.find((j) => j.id === reviewId && j.status === "review") ?? null;

  const appendDescription = (append: (description: string) => string) =>
    setDraft((d) => ({ ...d, description: append(d.description ?? "") }));
  // Never over the user's own text, as in the figure form.
  const applySuggestion = (suggestion: Suggestion) =>
    setDraft((d) => ({
      ...d,
      name: d.name.trim() ? d.name : suggestion.name,
      description: appendToDescription(
        d.description ?? "",
        suggestion.description,
      ),
    }));
  const reviewSource: ReviewSource = {
    ref: video,
    groupSize: 1,
    holdsOne: true,
    onDescriptionChange: appendDescription,
    onApplySuggestion: applySuggestion,
  };

  const openEditor = () => {
    if (!activeList) return;
    if (!local) {
      setEditBlocked(true);
      return;
    }
    onOpen();
    setAnonymizeTarget({
      listId: activeList.id,
      patternName: label,
      sourceUri: video.value,
      ...(video.generated && { generated: video.generated }),
      ...(video.transcript && { transcript: video.transcript }),
    });
  };
  const openTranscript = () => {
    if (!video.transcript) return;
    onOpen();
    setAnonymizeTarget(null);
    setTranscriptTarget({
      listId: activeList?.id,
      patternName: label,
      sourceUri: video.value,
      transcript: video.transcript,
      hasSound: !video.generated,
    });
  };
  const openPutOnline = () => {
    if (!activeList || !local) return;
    onOpen();
    setPutOnlineTarget({
      listId: activeList.id,
      sourceUri: video.value,
      patternName: label,
      inSequence: true,
    });
  };
  // The link has replaced the video: nothing left to put online.
  const putOnlineOpen =
    putOnlineTarget?.sourceUri === video.value ? putOnlineTarget : null;

  // A line corrected by hand: kept in the draft until Save, and its fix learned for the list.
  const correctTranscript = (uri: string, transcript: IVideoTranscript) => {
    if (activeList && video.value === uri && video.transcript) {
      rememberTranscriptEdit(activeList.id, video.transcript, transcript).catch(
        (e) => console.error("Error remembering transcript corrections:", e),
      );
    }
    setDraft((d) =>
      d.video?.value === uri ? { ...d, video: { ...d.video, transcript } } : d,
    );
    setAnonymizeTarget((prev) =>
      prev?.sourceUri === uri ? { ...prev, transcript } : prev,
    );
    setTranscriptTarget((prev) =>
      prev?.sourceUri === uri ? { ...prev, transcript } : prev,
    );
  };

  const anyTool = canEditVideos || !!video.transcript || (writable && local);
  return (
    <>
      {anyTool && (
        <View style={styles.row}>
          {canEditVideos && (
            <Button
              title={t("videoEditTitle")}
              icon="movie-edit"
              variant="secondary"
              size="sm"
              onPress={openEditor}
            />
          )}
          {video.transcript && (
            <IconButton
              icon="text-box-outline"
              color="primary"
              size={theme.iconSize.md}
              onPress={openTranscript}
              accessibilityLabel={t("transcriptShow")}
            />
          )}
          {writable && local && (
            <IconButton
              icon="cloud-upload-outline"
              color="primary"
              size={theme.iconSize.md}
              onPress={openPutOnline}
              accessibilityLabel={t("videoOnlineTitle")}
            />
          )}
        </View>
      )}
      <DraftJobLines jobs={draftJobs} onReview={setReviewId} />
      <VideoReviewModal
        job={reviewing}
        onClose={() => setReviewId(null)}
        source={reviewSource}
      />
      <AppDialog
        visible={editBlocked}
        title={t("videoEditTitle")}
        message={t("videoEditOnlineHint")}
        onClose={() => setEditBlocked(false)}
      />
      <AnonymizeModal
        target={anonymizeTarget}
        onClose={() => setAnonymizeTarget(null)}
        onTranscriptChange={
          writable && anonymizeTarget
            ? (transcript) =>
                correctTranscript(anonymizeTarget.sourceUri, transcript)
            : undefined
        }
      />
      <TranscriptSheet
        target={transcriptTarget}
        onClose={() => setTranscriptTarget(null)}
        onDescriptionChange={appendDescription}
        onApplySuggestion={applySuggestion}
        onTranscriptChange={
          writable && transcriptTarget
            ? (transcript) =>
                correctTranscript(transcriptTarget.sourceUri, transcript)
            : undefined
        }
        onRetranscribe={
          canEditVideos && transcriptTarget && activeList
            ? (language) =>
                startTranscription(
                  { ...transcriptTarget, listId: activeList.id },
                  language,
                )
            : undefined
        }
      />
      <PutOnlineSheet
        target={putOnlineOpen}
        onClose={() => setPutOnlineTarget(null)}
      />
    </>
  );
};

const styles = StyleSheet.create((theme) => ({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.space.sm,
    marginBottom: theme.space.xs,
  },
}));

export default SequenceVideoTools;
