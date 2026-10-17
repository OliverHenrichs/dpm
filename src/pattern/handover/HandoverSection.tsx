import React, { useEffect, useState } from "react";
import { ActivityIndicator, Clipboard, Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import { Button, IconButton } from "@/src/common/ui";
import AppDialog from "@/src/common/components/AppDialog";
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
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);

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
      setShowQr(false);
    });

  const handleWithdraw = () =>
    run(async () => {
      if (offer) await withdrawHandover(list, offer.code);
      setOffer(null);
    });

  const handleCopy = () => {
    if (!offer) return;
    Clipboard.setString(offer.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{t("handOverList")}</Text>
      {offer === undefined ? (
        <ActivityIndicator size="small" color={theme.colors.primary} />
      ) : offer ? (
        <>
          <View style={styles.codeRow}>
            <Text style={styles.code} selectable>
              {offer.code}
            </Text>
            <IconButton
              icon={copied ? "check" : "content-copy"}
              size={theme.iconSize.md}
              color={copied ? "success" : "primary"}
              onPress={handleCopy}
              accessibilityLabel={t("copyHandoverCode")}
            />
            <IconButton
              icon={showQr ? "qrcode-remove" : "qrcode"}
              size={theme.iconSize.md}
              onPress={() => setShowQr((v) => !v)}
              accessibilityLabel={t(showQr ? "hideQrCode" : "showQrCode")}
            />
          </View>
          {showQr && (
            <View style={styles.qrContainer}>
              <QRCode
                value={offer.code}
                size={160}
                color={theme.colors.text}
                backgroundColor={theme.colors.surface}
              />
            </View>
          )}
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
  codeRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.space.lg,
    paddingVertical: theme.space.md,
  },
  code: {
    ...theme.typography.headline,
    flex: 1,
    letterSpacing: 3,
    color: theme.colors.primary,
    fontVariant: ["tabular-nums"],
  },
  qrContainer: {
    alignItems: "center",
    paddingVertical: theme.space.lg,
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
