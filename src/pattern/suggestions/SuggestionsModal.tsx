import React, { useState } from "react";
import { Modal, ScrollView, Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import {
  getCommonDialogCard,
  getCommonFormSheet,
} from "@/src/common/utils/CommonStyles";
import { useTranslation } from "react-i18next";
import ModalOverlay from "@/src/common/components/ModalOverlay";
import RevealScrollView from "@/src/common/components/RevealScrollView";
import AppDialog from "@/src/common/components/AppDialog";
import { Button, Card, ListRow } from "@/src/common/ui";
import EditPatternForm from "@/src/pattern/list/EditPatternForm";
import {
  IModifier,
  IPattern,
  IPatternList,
  NewPattern,
} from "@/src/pattern/types/IPatternList";
import { PatternType } from "@/src/pattern/types/PatternType";
import {
  deleteSuggestion,
  muteSubscriber,
  PatternSuggestion,
  unmuteSubscriber,
} from "@/src/firebase/PatternSuggestionService";
import { patternFromSuggestion } from "@/src/pattern/suggestions/suggestions";
import { useMutedSubscribers } from "@/src/pattern/suggestions/useListSuggestions";

interface SuggestionsModalProps {
  visible: boolean;
  /** The publisher's own published list. */
  list: IPatternList;
  patterns: IPattern[];
  patternTypes: PatternType[];
  modifiers: IModifier[];
  suggestions: PatternSuggestion[];
  onClose: () => void;
  /** Adds the reviewed pattern to the list (`usePatternCrud.addPattern`); false keeps the form. */
  onAccept: (pattern: NewPattern) => Promise<boolean>;
}

/**
 * The publisher's review of what subscribers suggested: add one (through the pattern form,
 * seeded with the suggestion, so it can be corrected first), dismiss it, or mute whoever sent
 * it. Muted subscribers are listed below, each with a way back.
 */
const SuggestionsModal: React.FC<SuggestionsModalProps> = (props) =>
  props.visible ? <SuggestionsBody {...props} /> : null;

const SuggestionsBody: React.FC<SuggestionsModalProps> = ({
  list,
  patterns,
  patternTypes,
  modifiers,
  suggestions,
  onClose,
  onAccept,
}) => {
  const { t, i18n } = useTranslation();
  const muted = useMutedSubscribers(list);
  const mutedIds = new Set(muted.map((m) => m.uid));
  const [reviewing, setReviewing] = useState<{
    suggestion: PatternSuggestion;
    pattern: NewPattern;
  } | null>(null);
  const [muteTarget, setMuteTarget] = useState<PatternSuggestion | null>(null);
  const [error, setError] = useState<string | null>(null);

  const authorOf = (s: { authorName?: string; name?: string }) =>
    s.authorName ?? s.name ?? t("suggestionAnonymous");

  const run = async (action: () => Promise<void>) => {
    setError(null);
    try {
      await action();
    } catch (e) {
      console.warn("SuggestionsModal:", e);
      setError(t("suggestionActionFailed"));
    }
  };

  const handleAccept = async (pattern: NewPattern | IPattern) => {
    if (!reviewing) return false;
    const accepted = await onAccept(pattern);
    if (!accepted) return false;
    const { suggestion } = reviewing;
    setReviewing(null);
    // The pattern is in the list now; a suggestion left behind would only be offered again.
    await run(() => deleteSuggestion(list, suggestion.id));
    return true;
  };

  if (reviewing) {
    return (
      <Modal
        visible
        animationType="slide"
        transparent
        onRequestClose={() => setReviewing(null)}
      >
        <ModalOverlay padding="none">
          <View style={styles.formContent}>
            <RevealScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ flexGrow: 1 }}
            >
              <EditPatternForm
                patterns={patterns}
                patternTypes={patternTypes}
                modifiers={modifiers}
                initialPattern={reviewing.pattern}
                onAccepted={handleAccept}
                onCancel={() => setReviewing(null)}
                title={t("suggestionReviewTitle")}
                saveLabel={t("suggestionAdd")}
                header={
                  <Text style={styles.meta}>
                    {t("suggestionFrom", {
                      name: authorOf(reviewing.suggestion),
                    })}
                  </Text>
                }
              />
            </RevealScrollView>
          </View>
        </ModalOverlay>
      </Modal>
    );
  }

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <ModalOverlay>
        <View style={styles.card}>
          <Text style={styles.title}>{t("suggestionsTitle")}</Text>
          <Text style={styles.meta}>{list.name}</Text>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.body}>
            {!list.suggestions && (
              <Text style={styles.hint}>{t("suggestionsOffHint")}</Text>
            )}
            {suggestions.length === 0 && (
              <Text style={styles.hint}>{t("suggestionsEmpty")}</Text>
            )}
            {suggestions.map((suggestion) => {
              const pattern = patternFromSuggestion(
                suggestion.pattern,
                list,
                patterns,
              );
              const type = patternTypes.find((pt) => pt.id === pattern?.typeId);
              const when = suggestion.createdAt
                ? new Date(suggestion.createdAt).toLocaleDateString(
                    i18n.language,
                    { day: "numeric", month: "short" },
                  )
                : "";
              return (
                <Card key={suggestion.id} style={styles.suggestion}>
                  <Text style={styles.name}>
                    {pattern?.name ?? t("suggestionUnreadable")}
                  </Text>
                  <Text style={styles.meta}>
                    {[t("suggestionFrom", { name: authorOf(suggestion) }), when]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>
                  {pattern && (
                    <Text style={styles.meta}>
                      {[type?.slug, t("countsSection", { n: pattern.counts })]
                        .filter(Boolean)
                        .join(" · ")}
                    </Text>
                  )}
                  {!!pattern?.description.trim() && (
                    <Text style={styles.description} numberOfLines={3}>
                      {pattern.description.trim()}
                    </Text>
                  )}
                  <View style={styles.actions}>
                    {pattern && (
                      <Button
                        title={t("suggestionReview")}
                        size="sm"
                        onPress={() => setReviewing({ suggestion, pattern })}
                      />
                    )}
                    <Button
                      title={t("suggestionDismiss")}
                      size="sm"
                      variant="ghost"
                      onPress={() =>
                        run(() => deleteSuggestion(list, suggestion.id))
                      }
                    />
                    {suggestion.authorUid &&
                      !mutedIds.has(suggestion.authorUid) && (
                        <Button
                          title={t("suggestionMute")}
                          size="sm"
                          variant="dangerGhost"
                          onPress={() => setMuteTarget(suggestion)}
                        />
                      )}
                  </View>
                </Card>
              );
            })}
            {muted.length > 0 && (
              <>
                <Text style={styles.section}>{t("mutedSubscribers")}</Text>
                {muted.map((m) => (
                  <ListRow
                    key={m.uid}
                    variant="plain"
                    icon="volume-off"
                    title={authorOf(m)}
                    trailing={
                      <Button
                        title={t("suggestionUnmute")}
                        size="sm"
                        variant="ghost"
                        onPress={() => run(() => unmuteSubscriber(list, m.uid))}
                      />
                    }
                  />
                ))}
              </>
            )}
          </ScrollView>
          {error && <Text style={styles.error}>{error}</Text>}
          <Button title={t("close")} variant="secondary" onPress={onClose} />
        </View>
      </ModalOverlay>

      <AppDialog
        visible={muteTarget !== null}
        title={t("suggestionMuteTitle", {
          name: muteTarget ? authorOf(muteTarget) : "",
        })}
        message={t("suggestionMuteMessage")}
        closeLabel={t("cancel")}
        onClose={() => setMuteTarget(null)}
        confirmLabel={t("suggestionMute")}
        confirmDestructive
        onConfirm={() => {
          const target = muteTarget;
          setMuteTarget(null);
          if (target) {
            run(() =>
              muteSubscriber(list, target.authorUid, target.authorName),
            );
          }
        }}
      />
    </Modal>
  );
};

const styles = StyleSheet.create((theme) => ({
  formContent: getCommonFormSheet(theme),
  card: {
    ...getCommonDialogCard(theme),
    maxWidth: 480,
    maxHeight: "100%",
    gap: theme.space.sm,
  },
  scroll: {
    flexGrow: 0,
  },
  body: {
    gap: theme.space.md,
    paddingVertical: theme.space.sm,
  },
  title: {
    ...theme.typography.headline,
    color: theme.colors.text,
  },
  section: {
    ...theme.typography.caption,
    fontWeight: "600",
    color: theme.colors.textMuted,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginTop: theme.space.md,
  },
  suggestion: {
    gap: theme.space.xs,
  },
  name: {
    ...theme.typography.title,
    color: theme.colors.text,
  },
  meta: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
  },
  description: {
    ...theme.typography.body,
    color: theme.colors.text,
  },
  hint: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.space.sm,
    marginTop: theme.space.xs,
  },
  error: {
    ...theme.typography.bodySmall,
    color: theme.colors.danger,
  },
}));

export default SuggestionsModal;
