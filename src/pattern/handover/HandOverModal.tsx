import React, { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import { Button } from "@/src/common/ui";
import AppDialog from "@/src/common/components/AppDialog";
import ModalOverlay from "@/src/common/components/ModalOverlay";
import ShareableCode from "@/src/common/components/ShareableCode";
import {
  getOpenHandover,
  HANDOVER_DAYS,
  offerHandover,
  OpenHandover,
  withdrawHandover,
} from "@/src/firebase/HandoverService";
import { IPatternList } from "@/src/pattern/types/IPatternList";
import { getCommonDialogCard } from "@/src/common/utils/CommonStyles";

interface HandOverModalProps {
  /** The list owner's own published list. */
  list: IPatternList;
  onClose: () => void;
}

/**
 * Hands a published list over to someone who follows it (`src/pattern/handover/AGENTS.md`):
 * make an offer, show its code, or withdraw it. Opened from the list's ⋮ sheet.
 */
const HandOverModal: React.FC<HandOverModalProps> = ({ list, onClose }) => {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  // undefined while looking up an offer made earlier.
  const [offer, setOffer] = useState<OpenHandover | null | undefined>(
    undefined,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    let current = true;
    getOpenHandover(list).then(
      (open) => current && setOffer(open),
      () => current && setOffer(null),
    );
    return () => {
      current = false;
    };
    // Looked up once per list; offers change only through this section.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.shareCode]);

  const run = async (action: () => Promise<void>) => {
    setError(null);
    setBusy(true);
    try {
      await action();
    } catch (e) {
      console.warn("HandOverModal:", e);
      setError(t("handOverFailed"));
    } finally {
      setBusy(false);
    }
  };

  const handleOffer = () =>
    run(async () => {
      const code = await offerHandover(list);
      setOffer({ code, expiresAt: Date.now() + HANDOVER_DAYS * 86400000 });
    });

  const handleWithdraw = () =>
    run(async () => {
      if (offer) await withdrawHandover(list, offer.code);
      setOffer(null);
    });

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <ModalOverlay>
        <View style={styles.card}>
          <Text style={styles.title}>{t("handOverList")}</Text>
          <Text style={styles.meta}>{list.name}</Text>
          {offer === undefined ? (
            <ActivityIndicator size="small" color={theme.colors.primary} />
          ) : offer ? (
            <>
              <ShareableCode
                key={offer.code}
                code={offer.code}
                copyLabel={t("copyHandoverCode")}
              />
              <Text style={styles.hint}>
                {t("handOverCodeHint", { days: HANDOVER_DAYS })}
              </Text>
              <Button
                title={t("handOverWithdraw")}
                icon="close"
                variant="secondary"
                disabled={busy}
                onPress={handleWithdraw}
              />
            </>
          ) : (
            <>
              <Text style={styles.hint}>{t("handOverHint")}</Text>
              <Button
                title={t("handOverStart")}
                icon="account-switch-outline"
                disabled={busy}
                onPress={() => setConfirm(true)}
              />
            </>
          )}
          {error && <Text style={styles.errorText}>{error}</Text>}
          <Button title={t("done")} variant="ghost" onPress={onClose} />
        </View>
      </ModalOverlay>

      <AppDialog
        visible={confirm}
        title={t("handOverConfirmTitle")}
        message={t("handOverConfirmMessage")}
        closeLabel={t("cancel")}
        onClose={() => setConfirm(false)}
        confirmLabel={t("handOverStart")}
        onConfirm={() => {
          setConfirm(false);
          handleOffer();
        }}
      />
    </Modal>
  );
};

const styles = StyleSheet.create((theme) => ({
  card: {
    ...getCommonDialogCard(theme),
    maxWidth: 420,
    gap: theme.space.sm,
  },
  title: {
    ...theme.typography.headline,
    color: theme.colors.text,
  },
  meta: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
    marginBottom: theme.space.sm,
  },
  hint: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
  },
  errorText: {
    ...theme.typography.bodySmall,
    color: theme.colors.danger,
  },
}));

export default HandOverModal;
