import React, { useState } from "react";
import { ActivityIndicator, Modal, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import {
  getCommonDialogCard,
  getCommonCodeInput,
} from "@/src/common/utils/CommonStyles";
import { useTranslation } from "react-i18next";
import ModalOverlay from "@/src/common/components/ModalOverlay";
import QrCodeScanner from "@/src/common/components/QrCodeScanner";
import { useQrScanner } from "@/src/common/components/useQrScanner";
import { RevealTextInput } from "@/src/common/components/reveal";
import { Button, IconButton } from "@/src/common/ui";
import {
  acceptHandover,
  HANDOVER_CODE_LENGTH,
  HANDOVER_DAYS,
  HandoverRefusedError,
} from "@/src/firebase/HandoverService";
import { IPatternList } from "@/src/pattern/types/IPatternList";

interface TakeOverListModalProps {
  /** A subscribed (read-only) copy of a published list. */
  list: IPatternList;
  onClose: () => void;
  /** Called once the handover went through, with the list made editable and its new share key. */
  onTakenOver: (updatedList: IPatternList) => void;
}

/**
 * Taking a subscribed list over with the code its owner gave (`src/pattern/handover/AGENTS.md`).
 * The list keeps its share code, so the other subscribers follow the new owner.
 */
const TakeOverListModal: React.FC<TakeOverListModalProps> = ({
  list,
  onClose,
  onTakenOver,
}) => {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const takeOver = async (value: string) => {
    const trimmed = value.trim().toUpperCase();
    if (trimmed.length !== HANDOVER_CODE_LENGTH) {
      setError(t("takeOverInvalidCode"));
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const shareKey = await acceptHandover(list, trimmed);
      const { readonly: _readonly, ...rest } = list;
      onTakenOver({ ...rest, shareKey });
    } catch (e) {
      if (!(e instanceof HandoverRefusedError))
        console.warn("TakeOverListModal:", e);
      setError(
        e instanceof HandoverRefusedError
          ? t("takeOverRefused", { days: HANDOVER_DAYS })
          : t("takeOverFailed"),
      );
    } finally {
      setBusy(false);
    }
  };

  const scanner = useQrScanner(
    (scanned) => {
      setCode(scanned);
      void takeOver(scanned);
    },
    () => setError(t("cameraPermissionDenied")),
  );

  return (
    <>
      <Modal visible animationType="slide" transparent onRequestClose={onClose}>
        <ModalOverlay>
          <View style={styles.card}>
            <Text style={styles.title}>{t("takeOverList")}</Text>
            <Text style={styles.listName}>{list.name}</Text>
            <Text style={styles.hint}>{t("takeOverHint")}</Text>

            <View style={styles.inputRow}>
              <RevealTextInput
                style={styles.input}
                value={code}
                onChangeText={(v) => {
                  setCode(v.toUpperCase());
                  setError(null);
                }}
                placeholder={t("handoverCodePlaceholder")}
                placeholderTextColor={theme.colors.textMuted}
                autoCapitalize="characters"
                maxLength={HANDOVER_CODE_LENGTH}
                returnKeyType="done"
                onSubmitEditing={() => void takeOver(code)}
                accessibilityLabel={t("handoverCodePlaceholder")}
              />
              <IconButton
                icon="qrcode-scan"
                variant="filled"
                size={theme.iconSize.md}
                onPress={scanner.start}
                accessibilityLabel={t("scanQrCode")}
                style={styles.scanButton}
              />
            </View>

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
                title={t("takeOver")}
                onPress={() => void takeOver(code)}
                disabled={busy || code.trim().length !== HANDOVER_CODE_LENGTH}
                style={styles.footerButton}
              />
            </View>
          </View>
        </ModalOverlay>
      </Modal>

      <QrCodeScanner
        {...scanner.scannerProps}
        hint={t("scanHandoverCodeHint")}
      />
    </>
  );
};

const styles = StyleSheet.create((theme) => ({
  card: {
    ...getCommonDialogCard(theme),
    maxWidth: 420,
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
    marginBottom: theme.space.lg,
  },
  inputRow: {
    flexDirection: "row",
    gap: theme.space.md,
    marginBottom: theme.space.sm,
  },
  input: getCommonCodeInput(theme),
  scanButton: {
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.space.lg,
  },
  errorText: {
    ...theme.typography.bodySmall,
    color: theme.colors.danger,
    marginBottom: theme.space.sm,
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

export default TakeOverListModal;
