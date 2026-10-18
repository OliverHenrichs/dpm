import React, { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import { Button } from "@/src/common/ui";
import AppDialog from "@/src/common/components/AppDialog";
import ShareableCode from "@/src/common/components/ShareableCode";
import {
  getOpenHandover,
  HANDOVER_DAYS,
  offerHandover,
  OpenHandover,
  withdrawHandover,
} from "@/src/firebase/HandoverService";
import { IPatternList } from "@/src/pattern/types/IPatternList";

/**
 * The part of the share sheet that hands a published list over to someone who follows it
 * (`src/pattern/handover/AGENTS.md`): make an offer, show its code, or withdraw it.
 */
const HandoverSection: React.FC<{ list: IPatternList }> = ({ list }) => {
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
      console.warn("HandoverSection:", e);
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
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{t("handOverList")}</Text>
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
            variant="secondary"
            disabled={busy}
            onPress={() => setConfirm(true)}
          />
        </>
      )}
      {error && <Text style={styles.errorText}>{error}</Text>}

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
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
  section: {
    gap: theme.space.sm,
    marginBottom: theme.space.xl,
  },
  sectionLabel: {
    ...theme.typography.caption,
    fontWeight: "600",
    color: theme.colors.textMuted,
    letterSpacing: 1,
    textTransform: "uppercase",
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

export default HandoverSection;
