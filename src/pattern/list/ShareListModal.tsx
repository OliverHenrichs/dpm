import React, { useState } from "react";
import {
  ActivityIndicator,
  Clipboard,
  Modal,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { alpha } from "@/src/common/theme/tokens";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
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
      <View style={styles.overlay}>
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
                <TouchableOpacity
                  style={styles.copyButton}
                  onPress={handleCopy}
                  accessibilityLabel={t("copyShareCode")}
                >
                  <Icon
                    name={copied ? "check" : "content-copy"}
                    size={20}
                    color={copied ? theme.colors.success : theme.colors.primary}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.copyButton}
                  onPress={() => setShowQr((v) => !v)}
                  accessibilityLabel={t(showQr ? "hideQrCode" : "showQrCode")}
                >
                  <Icon
                    name={showQr ? "qrcode-remove" : "qrcode"}
                    size={20}
                    color={theme.colors.primary}
                  />
                </TouchableOpacity>
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
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={handlePublish}
                >
                  <Icon
                    name="cloud-upload-outline"
                    size={18}
                    color={theme.colors.onPrimary}
                  />
                  <Text style={styles.primaryButtonText}>
                    {isPublished ? t("syncToCloud") : t("publishToCloud")}
                  </Text>
                </TouchableOpacity>
              )}
              {firebaseAvailable && isPublished && (
                <TouchableOpacity
                  style={styles.destructiveButton}
                  onPress={() => setConfirmUnpublish(true)}
                >
                  <Icon
                    name="cloud-off-outline"
                    size={18}
                    color={theme.colors.danger}
                  />
                  <Text style={styles.destructiveButtonText}>
                    {t("unpublish")}
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                <Text style={styles.cancelButtonText}>{t("cancel")}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

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
  overlay: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    justifyContent: "center",
    alignItems: "center",
    padding: theme.space.xl,
  },
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
  copyButton: {
    padding: theme.space.xs,
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
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.space.sm,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    padding: theme.space.lg,
  },
  primaryButtonText: {
    ...theme.typography.button,
    color: theme.colors.onPrimary,
  },
  destructiveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.space.sm,
    borderRadius: theme.radius.md,
    padding: theme.space.lg,
    borderWidth: 1,
    borderColor: theme.colors.danger,
  },
  destructiveButtonText: {
    ...theme.typography.button,
    color: theme.colors.danger,
  },
  cancelButton: {
    borderRadius: theme.radius.md,
    padding: theme.space.lg,
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cancelButtonText: {
    ...theme.typography.button,
    color: theme.colors.text,
  },
}));

export default ShareListModal;
