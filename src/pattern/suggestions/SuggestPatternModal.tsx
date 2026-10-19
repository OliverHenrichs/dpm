import React, { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import ModalOverlay from "@/src/common/components/ModalOverlay";
import RevealScrollView from "@/src/common/components/RevealScrollView";
import { RevealTextInput } from "@/src/common/components/reveal";
import AppDialog from "@/src/common/components/AppDialog";
import { Button } from "@/src/common/ui";
import {
  getCommonDialogCard,
  getCommonFormSheet,
  getCommonInput,
  getCommonLabel,
} from "@/src/common/utils/CommonStyles";
import EditPatternForm from "@/src/pattern/list/EditPatternForm";
import {
  IModifier,
  IPattern,
  IPatternList,
  NewPattern,
} from "@/src/pattern/types/IPatternList";
import { PatternType } from "@/src/pattern/types/PatternType";
import {
  getSuggestionStanding,
  submitSuggestion,
} from "@/src/firebase/PatternSuggestionService";
import {
  getSuggesterName,
  setSuggesterName,
} from "@/src/pattern/suggestions/SuggesterNameStorage";
import {
  MAX_AUTHOR_NAME_LENGTH,
  MAX_SUGGESTED_NAME_LENGTH,
} from "@/src/pattern/suggestions/suggestions";
import { useTermsConsent } from "@/src/legal/useTermsConsent";

interface SuggestPatternModalProps {
  visible: boolean;
  /** A subscribed list that takes suggestions (`canSuggestTo`). */
  list: IPatternList;
  patterns: IPattern[];
  patternTypes: PatternType[];
  modifiers: IModifier[];
  onClose: () => void;
}

/**
 * A subscriber suggests a new pattern to the list's publisher: the pattern form, signed with a
 * name of their choosing. The limit and a mute are checked when it opens, so the form is not
 * offered when it could not be sent; the security rules decide in the end.
 */
const SuggestPatternModal: React.FC<SuggestPatternModalProps> = (props) =>
  // Rendered only while open, so every opening asks afresh how many are left today.
  props.visible ? <SuggestPatternBody {...props} /> : null;

type Phase =
  | { kind: "loading" }
  | { kind: "ready"; remaining: number }
  | { kind: "blocked"; message: string }
  | { kind: "sent" };

const SuggestPatternBody: React.FC<SuggestPatternModalProps> = ({
  list,
  patterns,
  patternTypes,
  modifiers,
  onClose,
}) => {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  // A suggestion is shared with the publisher: the terms of use are agreed to before the form.
  const { withTerms, termsDialog } = useTermsConsent();
  const [agreed, setAgreed] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const policy = list.suggestions;
  const shareCode = list.shareCode;
  const [phase, setPhase] = useState<Phase>(() =>
    policy && shareCode
      ? { kind: "loading" }
      : { kind: "blocked", message: t("suggestClosed") },
  );

  useEffect(() => {
    let cancelled = false;
    withTerms(() => !cancelled && setAgreed(true), onClose);
    getSuggesterName().then((stored) => {
      if (!cancelled) setName((typed) => typed || stored);
    });
    if (!policy || !shareCode) {
      return () => {
        cancelled = true;
      };
    }
    getSuggestionStanding(shareCode, policy).then(
      (standing) => {
        if (cancelled) return;
        if (standing.muted) {
          setPhase({ kind: "blocked", message: t("suggestMuted") });
        } else if (standing.remaining === 0) {
          setPhase({ kind: "blocked", message: t("suggestLimitReached") });
        } else {
          setPhase({ kind: "ready", remaining: standing.remaining });
        }
      },
      (e: unknown) => {
        if (cancelled) return;
        console.warn("SuggestPatternModal:", e);
        setPhase({ kind: "blocked", message: t("suggestUnavailable") });
      },
    );
    return () => {
      cancelled = true;
    };
    // Asked once per opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (pattern: NewPattern | IPattern) => {
    if (!policy || !shareCode) return false;
    setError(null);
    await setSuggesterName(name);
    try {
      const result = await submitSuggestion(
        shareCode,
        policy,
        pattern,
        name || undefined,
      );
      if (result === "sent") {
        setPhase({ kind: "sent" });
        return true;
      }
      setPhase({
        kind: "blocked",
        message: t(
          result === "muted"
            ? "suggestMuted"
            : result === "limit"
              ? "suggestLimitReached"
              : "suggestClosed",
        ),
      });
      return false;
    } catch (e) {
      console.warn("SuggestPatternModal: submit failed", e);
      // Keep what was typed: the form stays open and says so.
      setError(t("suggestSendFailed"));
      return false;
    }
  };

  if (phase.kind === "ready" && agreed) {
    return (
      <Modal visible animationType="slide" transparent onRequestClose={onClose}>
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
                onAccepted={handleSubmit}
                onCancel={onClose}
                title={t("suggestPattern")}
                saveLabel={t("suggestSend")}
                nameMaxLength={MAX_SUGGESTED_NAME_LENGTH}
                header={
                  <View style={styles.header}>
                    <Text style={styles.hint}>
                      {t("suggestIntro", { list: list.name })}
                    </Text>
                    <Text style={styles.label}>{t("suggestYourName")}</Text>
                    <RevealTextInput
                      value={name}
                      onChangeText={setName}
                      placeholder={t("suggestYourNamePlaceholder")}
                      placeholderTextColor={theme.colors.textMuted}
                      accessibilityLabel={t("suggestYourName")}
                      maxLength={MAX_AUTHOR_NAME_LENGTH}
                      autoCorrect={false}
                      style={styles.input}
                    />
                    <Text style={styles.hint}>
                      {t("suggestRemaining", { count: phase.remaining })}
                    </Text>
                    <Text style={styles.hint}>{t("suggestVideosHint")}</Text>
                    {error && <Text style={styles.error}>{error}</Text>}
                  </View>
                }
              />
            </RevealScrollView>
          </View>
        </ModalOverlay>
      </Modal>
    );
  }

  if (phase.kind === "sent") {
    return (
      <AppDialog
        visible
        title={t("suggestSentTitle")}
        message={t("suggestSentMessage")}
        onClose={onClose}
      />
    );
  }

  return (
    <Modal visible animationType="fade" transparent onRequestClose={onClose}>
      <ModalOverlay>
        <View style={styles.card}>
          <Text style={styles.title}>{t("suggestPattern")}</Text>
          {phase.kind === "blocked" ? (
            <Text style={styles.message}>{phase.message}</Text>
          ) : (
            <ActivityIndicator
              size="large"
              color={theme.colors.primary}
              style={styles.spinner}
            />
          )}
          <Button title={t("close")} variant="secondary" onPress={onClose} />
        </View>
      </ModalOverlay>
      {phase.kind !== "blocked" && termsDialog}
    </Modal>
  );
};

const styles = StyleSheet.create((theme) => ({
  formContent: getCommonFormSheet(theme),
  header: {
    gap: theme.space.xs,
    marginBottom: theme.space.md,
  },
  label: getCommonLabel(theme),
  input: getCommonInput(theme),
  hint: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
  },
  error: {
    ...theme.typography.bodySmall,
    color: theme.colors.danger,
  },
  card: {
    ...getCommonDialogCard(theme),
    maxWidth: 420,
    gap: theme.space.lg,
  },
  title: {
    ...theme.typography.headline,
    color: theme.colors.text,
  },
  message: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
  },
  spinner: {
    marginVertical: theme.space.xl,
  },
}));

export default SuggestPatternModal;
