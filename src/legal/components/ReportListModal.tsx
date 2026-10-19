import React, { useState } from "react";
import { ActivityIndicator, Modal, ScrollView, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import ModalOverlay from "@/src/common/components/ModalOverlay";
import AppDialog from "@/src/common/components/AppDialog";
import { RevealTextInput } from "@/src/common/components/reveal";
import { Button, Chip } from "@/src/common/ui";
import {
  getCommonDialogCard,
  getCommonInput,
  getCommonLabel,
} from "@/src/common/utils/CommonStyles";
import { reportList } from "@/src/firebase/ReportService";
import { IPatternList } from "@/src/pattern/types/IPatternList";
import {
  MAX_REPORT_CONTACT_LENGTH,
  MAX_REPORT_DETAILS_LENGTH,
  REPORT_REASON_LABEL_KEYS,
  REPORT_REASONS,
  ReportReason,
} from "@/src/legal/reports";
import { openLegalPage, TERMS_URL } from "@/src/legal/legalLinks";

interface ReportListModalProps {
  /** A subscribed copy of a published list (it has a share code). */
  list: IPatternList;
  onClose: () => void;
}

/**
 * Reporting a subscribed list to the operator (TERMS_OF_USE.md §4): what is wrong, optionally
 * where and how to reply. The publisher is not told who reported it.
 */
const ReportListModal: React.FC<ReportListModalProps> = ({ list, onClose }) => {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [contact, setContact] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const send = async () => {
    if (!reason || !list.shareCode) return;
    setError(null);
    setBusy(true);
    try {
      await reportList(list.shareCode, reason, details, contact);
      setSent(true);
    } catch (e) {
      console.warn("ReportListModal:", e);
      setError(t("reportFailed"));
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <AppDialog
        visible
        title={t("reportSentTitle")}
        message={t("reportSentMessage")}
        onClose={onClose}
      />
    );
  }

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <ModalOverlay>
        <View style={styles.card}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.title}>{t("reportList")}</Text>
            <Text style={styles.listName}>{list.name}</Text>
            <Text style={styles.hint}>{t("reportListHint")}</Text>

            <Text style={styles.label}>{t("reportReason")}</Text>
            <View style={styles.reasons}>
              {REPORT_REASONS.map((r) => (
                <Chip
                  key={r}
                  label={t(REPORT_REASON_LABEL_KEYS[r])}
                  selected={reason === r}
                  onPress={() => setReason(r)}
                />
              ))}
            </View>

            <Text style={styles.label}>{t("reportDetails")}</Text>
            <RevealTextInput
              value={details}
              onChangeText={setDetails}
              placeholder={t("reportDetailsPlaceholder")}
              placeholderTextColor={theme.colors.textMuted}
              accessibilityLabel={t("reportDetails")}
              maxLength={MAX_REPORT_DETAILS_LENGTH}
              multiline
              style={[styles.input, styles.details]}
            />

            <Text style={styles.label}>{t("reportContact")}</Text>
            <RevealTextInput
              value={contact}
              onChangeText={setContact}
              placeholder={t("reportContactPlaceholder")}
              placeholderTextColor={theme.colors.textMuted}
              accessibilityLabel={t("reportContact")}
              maxLength={MAX_REPORT_CONTACT_LENGTH}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />

            <Text style={styles.hint}>{t("reportGoodFaith")}</Text>
            <Button
              title={t("termsRead")}
              icon="open-in-new"
              variant="ghost"
              size="sm"
              onPress={() => openLegalPage(TERMS_URL)}
              style={styles.termsLink}
            />

            {error && <Text style={styles.errorText}>{error}</Text>}
            {busy && (
              <ActivityIndicator
                size="small"
                color={theme.colors.primary}
                style={styles.spinner}
              />
            )}

            <View style={styles.buttonRow}>
              <Button
                title={t("cancel")}
                variant="secondary"
                onPress={onClose}
                style={styles.footerButton}
              />
              <Button
                title={t("reportSend")}
                onPress={() => void send()}
                disabled={busy || !reason}
                style={styles.footerButton}
              />
            </View>
          </ScrollView>
        </View>
      </ModalOverlay>
    </Modal>
  );
};

const styles = StyleSheet.create((theme) => ({
  card: {
    ...getCommonDialogCard(theme),
    maxWidth: 420,
    maxHeight: "90%",
  },
  title: {
    ...theme.typography.headline,
    color: theme.colors.text,
    marginBottom: theme.space.xs,
  },
  listName: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
    marginBottom: theme.space.lg,
  },
  hint: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
    marginBottom: theme.space.md,
  },
  label: {
    ...getCommonLabel(theme),
    marginBottom: theme.space.xs,
  },
  reasons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.space.sm,
    marginBottom: theme.space.lg,
  },
  input: {
    ...getCommonInput(theme),
    marginBottom: theme.space.lg,
  },
  details: {
    minHeight: 88,
    textAlignVertical: "top",
  },
  termsLink: {
    alignSelf: "flex-start",
  },
  errorText: {
    ...theme.typography.bodySmall,
    color: theme.colors.danger,
    marginTop: theme.space.sm,
  },
  spinner: {
    marginVertical: theme.space.sm,
  },
  buttonRow: {
    flexDirection: "row",
    gap: theme.space.md,
    marginTop: theme.space.xl,
  },
  footerButton: { flex: 1 },
}));

export default ReportListModal;
