import React, { useState } from "react";
import { ActivityIndicator, Clipboard, Modal, Text, View } from "react-native";
import ModalOverlay from "@/src/common/components/ModalOverlay";
import { Button, IconButton } from "@/src/common/ui";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { alpha } from "@/src/common/theme/tokens";
import { Icon } from "@/src/common/ui/Icon";
import QRCode from "react-native-qrcode-svg";
import { useTranslation } from "react-i18next";
import { IPatternList, IPattern } from "@/src/pattern/types/IPatternList";
import { publishList, unpublishList } from "@/src/firebase/FirebaseListService";
import { firebaseAvailable } from "@/src/firebase/firebaseConfig";
import AppDialog from "@/src/common/components/AppDialog";

interface ShareListModalProps {
  visible: boolean;
  list: IPatternList;
  patterns: IPattern[];
  onClose: () => void;
  /** Called after a successful publish/sync with the updated list (carrying shareCode). */
  onPublished: (updatedList: IPatternList) => void;
  /** Called after the user confirms unpublishing. */
  onUnpublished: (updatedList: IPatternList) => void;
}

const ShareListModal: React.FC<ShareListModalProps> = ({
  visible,
  list,
  patterns,
  onClose,
  onPublished,
  onUnpublished,
}) => {
  const { t } = useTranslation();
  const { theme } = useUnistyles();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [confirmUnpublish, setConfirmUnpublish] = useState(false);
  // Pending unpublished list — shown in success dialog before closing the modal
  const [unpublishPending, setUnpublishPending] = useState<IPatternList | null>(
    null,
  );

  const isPublished = !!list.shareCode;

  const handlePublish = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const shareCode = await publishList(list, patterns);
      onPublished({ ...list, shareCode });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnpublish = async () => {
    if (!list.shareCode) return;
    setError(null);
    setIsLoading(true);
    try {
      await unpublishList(list.shareCode);
      const { shareCode: _removed, ...rest } = list;
      // Show success dialog before propagating — the modal stays visible until dismissed
      setUnpublishPending(rest as IPatternList);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (!list.shareCode) return;
    Clipboard.setString(list.shareCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <ModalOverlay>
        <View style={styles.card}>
          <Text style={styles.title}>{t("shareToCloud")}</Text>
          <Text style={styles.listName}>{list.name}</Text>

          {!firebaseAvailable && (
            <View style={styles.warningBox}>
              <Icon
                name="alert-circle-outline"
                size={18}
                color={theme.colors.danger}
              />
              <Text style={styles.warningText}>{t("sharingNotAvailable")}</Text>
            </View>
          )}

          {firebaseAvailable && isPublished && list.shareCode && (
            <>
              <Text style={styles.sectionLabel}>{t("shareCode")}</Text>
              <View style={styles.codeRow}>
                <Text style={styles.code}>{list.shareCode}</Text>
                <IconButton
                  icon={copied ? "check" : "content-copy"}
                  size={theme.iconSize.md}
                  color={copied ? "success" : "primary"}
                  onPress={handleCopy}
                  accessibilityLabel={t("copyShareCode")}
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
                    value={list.shareCode}
                    size={160}
                    color={theme.colors.text}
                    backgroundColor={theme.colors.surface}
                  />
                </View>
              )}
              <Text style={styles.hint}>{t("shareCodeHint")}</Text>
            </>
          )}

          {error && <Text style={styles.errorText}>{error}</Text>}

          {isLoading ? (
            <ActivityIndicator
              size="large"
              color={theme.colors.primary}
              style={styles.spinner}
            />
          ) : (
            <View style={styles.buttonCol}>
              {firebaseAvailable && (
                <Button
                  title={isPublished ? t("syncToCloud") : t("publishToCloud")}
                  icon="cloud-upload-outline"
                  onPress={handlePublish}
                />
              )}
              {firebaseAvailable && isPublished && (
                <Button
                  title={t("unpublish")}
                  icon="cloud-off-outline"
                  variant="dangerOutline"
                  onPress={() => setConfirmUnpublish(true)}
                />
              )}
              <Button
                title={t("cancel")}
                variant="secondary"
                onPress={onClose}
              />
            </View>
          )}
        </View>
      </ModalOverlay>

      {/* ── Unpublish confirmation dialog ────────────────────────────── */}
      <AppDialog
        visible={confirmUnpublish}
        title={t("unpublishConfirmTitle")}
        message={t("unpublishConfirmMessage")}
        closeLabel={t("cancel")}
        onClose={() => setConfirmUnpublish(false)}
        confirmLabel={t("unpublish")}
        confirmDestructive
        onConfirm={() => {
          setConfirmUnpublish(false);
          handleUnpublish();
        }}
      />

      {/* ── Unpublish success dialog ─────────────────────────────────── */}
      <AppDialog
        visible={unpublishPending !== null}
        title={t("unpublishSuccessTitle")}
        message={t("unpublishSuccessMessage")}
        onClose={() => {
          const pending = unpublishPending;
          setUnpublishPending(null);
          if (pending) {
            onUnpublished(pending);
            onClose();
          }
        }}
      />
    </Modal>
  );
};

const styles = StyleSheet.create((theme) => ({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    padding: theme.space.xxl,
    width: "100%",
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
    marginBottom: theme.space.xl,
  },
  sectionLabel: {
    ...theme.typography.caption,
    fontWeight: "600",
    color: theme.colors.textMuted,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: theme.space.sm,
  },
  codeRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.space.lg,
    paddingVertical: theme.space.md,
    marginBottom: theme.space.sm,
  },
  code: {
    ...theme.typography.display,
    flex: 1,
    letterSpacing: 4,
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
    marginBottom: theme.space.xl,
  },
  warningBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.space.sm,
    backgroundColor: alpha(theme.colors.danger, 0.08),
    borderRadius: theme.radius.md,
    padding: theme.space.md,
    marginBottom: theme.space.xl,
  },
  warningText: {
    ...theme.typography.bodySmall,
    flex: 1,
    color: theme.colors.danger,
  },
  errorText: {
    ...theme.typography.bodySmall,
    color: theme.colors.danger,
    marginBottom: theme.space.md,
  },
  spinner: {
    marginVertical: theme.space.xl,
  },
  buttonCol: {
    gap: theme.space.md,
  },
}));

export default ShareListModal;
