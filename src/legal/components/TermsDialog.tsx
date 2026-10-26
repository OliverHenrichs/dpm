import React from "react";
import { Modal, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import ModalOverlay from "@/src/common/components/ModalOverlay";
import { getCommonDialogCard } from "@/src/common/utils/CommonStyles";
import { AppText, Button } from "@/src/common/ui";
import { openLegalPage, TERMS_URL } from "@/src/legal/legalLinks";

interface TermsDialogProps {
  visible: boolean;
  onAgree: () => void;
  onCancel: () => void;
}

/**
 * Asks for agreement to the terms of use before the first share (Play's user-generated content
 * policy: terms accepted before anything is published). The gist is in the message; the full
 * text opens in the browser.
 */
const TermsDialog: React.FC<TermsDialogProps> = ({
  visible,
  onAgree,
  onCancel,
}) => {
  const { t } = useTranslation();
  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onCancel}
    >
      <ModalOverlay padding="xxxl">
        <View style={styles.card} accessibilityRole="alert">
          <AppText variant="title" style={styles.title}>
            {t("termsTitle")}
          </AppText>
          <AppText color="textMuted" style={styles.message}>
            {t("termsMessage")}
          </AppText>
          <Button
            title={t("termsRead")}
            icon="open-in-new"
            variant="outline"
            onPress={() => openLegalPage(TERMS_URL)}
            style={styles.readButton}
          />
          <View style={styles.buttonRow}>
            <Button title={t("cancel")} variant="ghost" onPress={onCancel} />
            <Button title={t("termsAgree")} onPress={onAgree} />
          </View>
        </View>
      </ModalOverlay>
    </Modal>
  );
};

const styles = StyleSheet.create((theme) => ({
  card: {
    ...getCommonDialogCard(theme),
    maxWidth: 380,
    ...theme.elevation.lg,
  },
  title: {
    marginBottom: theme.space.sm,
  },
  message: {
    marginBottom: theme.space.lg,
  },
  readButton: {
    alignSelf: "flex-start",
    marginBottom: theme.space.xxl,
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: theme.space.sm,
  },
}));

export default TermsDialog;
