import React, { useState } from "react";
import {
  ActivityIndicator,
  Clipboard,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import QRCode from "react-native-qrcode-svg";
import { useTranslation } from "react-i18next";
import { getPalette, PaletteColor } from "@/src/common/utils/ColorPalette";
import { useThemeContext } from "@/src/common/components/ThemeContext";
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
  const { colorScheme } = useThemeContext();
  const palette = getPalette(colorScheme);
  const styles = getStyles(palette);

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
                color={palette[PaletteColor.Error]}
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
                    color={
                      copied
                        ? palette[PaletteColor.Accent]
                        : palette[PaletteColor.Primary]
                    }
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
                    color={palette[PaletteColor.Primary]}
                  />
                </TouchableOpacity>
              </View>
              {showQr && (
                <View style={styles.qrContainer}>
                  <QRCode
                    value={list.shareCode}
                    size={160}
                    color={palette[PaletteColor.PrimaryText]}
                    backgroundColor={palette[PaletteColor.Surface]}
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
              color={palette[PaletteColor.Primary]}
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
                    color={palette[PaletteColor.Surface]}
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
                    color={palette[PaletteColor.Error]}
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

const getStyles = (palette: Record<PaletteColor, string>) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
    },
    card: {
      backgroundColor: palette[PaletteColor.Surface],
      borderRadius: 16,
      padding: 24,
      width: "100%",
      maxWidth: 420,
    },
    title: {
      fontSize: 20,
      fontWeight: "bold",
      color: palette[PaletteColor.PrimaryText],
      marginBottom: 4,
    },
    listName: {
      fontSize: 15,
      color: palette[PaletteColor.SecondaryText],
      marginBottom: 20,
    },
    sectionLabel: {
      fontSize: 12,
      fontWeight: "600",
      color: palette[PaletteColor.SecondaryText],
      letterSpacing: 1,
      textTransform: "uppercase",
      marginBottom: 8,
    },
    codeRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: palette[PaletteColor.Background],
      borderRadius: 8,
      paddingHorizontal: 16,
      paddingVertical: 12,
      marginBottom: 8,
    },
    code: {
      flex: 1,
      fontSize: 24,
      fontWeight: "bold",
      letterSpacing: 4,
      color: palette[PaletteColor.Primary],
      fontVariant: ["tabular-nums"],
    },
    copyButton: {
      padding: 4,
    },
    qrContainer: {
      alignItems: "center",
      paddingVertical: 16,
    },
    hint: {
      fontSize: 13,
      color: palette[PaletteColor.SecondaryText],
      marginBottom: 20,
    },
    warningBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: palette[PaletteColor.Error] + "15",
      borderRadius: 8,
      padding: 12,
      marginBottom: 20,
    },
    warningText: {
      flex: 1,
      fontSize: 13,
      color: palette[PaletteColor.Error],
    },
    errorText: {
      color: palette[PaletteColor.Error],
      fontSize: 13,
      marginBottom: 12,
    },
    spinner: {
      marginVertical: 20,
    },
    buttonCol: {
      gap: 10,
    },
    primaryButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: palette[PaletteColor.Primary],
      borderRadius: 8,
      padding: 14,
    },
    primaryButtonText: {
      fontSize: 16,
      fontWeight: "600",
      color: palette[PaletteColor.Surface],
    },
    destructiveButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      borderRadius: 8,
      padding: 14,
      borderWidth: 1,
      borderColor: palette[PaletteColor.Error],
    },
    destructiveButtonText: {
      fontSize: 16,
      fontWeight: "600",
      color: palette[PaletteColor.Error],
    },
    cancelButton: {
      borderRadius: 8,
      padding: 14,
      alignItems: "center",
      borderWidth: 1,
      borderColor: palette[PaletteColor.Border],
    },
    cancelButtonText: {
      fontSize: 16,
      fontWeight: "600",
      color: palette[PaletteColor.PrimaryText],
    },
  });

export default ShareListModal;
