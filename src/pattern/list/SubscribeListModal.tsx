import React, { useState } from "react";
import { ActivityIndicator, Modal, Text, TextInput, View } from "react-native";
import { Button, IconButton } from "@/src/common/ui";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { alpha } from "@/src/common/theme/tokens";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { useTranslation } from "react-i18next";
import { useCameraPermissions } from "expo-camera";
import QrCodeScanner from "@/src/common/components/QrCodeScanner";
import { fetchSharedList } from "@/src/firebase/FirebaseListService";
import { firebaseAvailable } from "@/src/firebase/firebaseConfig";
import { PatternListWithPatterns } from "@/src/pattern/data/types/IExportData";
import { IPatternList } from "@/src/pattern/types/IPatternList";

interface SubscribeListModalProps {
  visible: boolean;
  existingLists: IPatternList[];
  onClose: () => void;
  /** Called with the fetched list once the user confirms subscribing. */
  onSubscribe: (list: PatternListWithPatterns) => void;
}

const SubscribeListModal: React.FC<SubscribeListModalProps> = ({
  visible,
  existingLists,
  onClose,
  onSubscribe,
}) => {
  const { t } = useTranslation();
  const { theme } = useUnistyles();

  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PatternListWithPatterns | null>(null);
  const [scanning, setScanning] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const handleLookup = async () => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length !== 8) {
      setError(t("invalidShareCode"));
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      const result = await fetchSharedList(trimmed);
      if (!result) {
        setError(t("shareCodeNotFound"));
        return;
      }
      // Block subscribing to a list whose UUID already exists locally.
      // Covers "you are the publisher" and "already subscribed".
      const localMatch = existingLists.find((l) => l.id === result.id);
      if (localMatch) {
        setError(
          localMatch.shareCode === trimmed
            ? t("subscribeErrorOwnList")
            : t("subscribeErrorAlreadySubscribed"),
        );
        return;
      }
      setPreview(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = () => {
    if (!preview) return;
    onSubscribe(preview);
    handleClose();
  };

  const handleScanPress = async () => {
    if (!cameraPermission?.granted) {
      const result = await requestCameraPermission();
      if (!result.granted) {
        setError(t("cameraPermissionDenied"));
        return;
      }
    }
    setScanning(true);
  };

  const handleBarCodeScanned = (data: string) => {
    const trimmed = data.trim().toUpperCase();
    setScanning(false);
    if (trimmed.length === 8) {
      setCode(trimmed);
      setError(null);
      setPreview(null);
      // Auto-lookup after scan
      setTimeout(() => {
        setError(null);
        setIsLoading(true);
        fetchSharedList(trimmed)
          .then((result) => {
            if (!result) {
              setError(t("shareCodeNotFound"));
              return;
            }
            const localMatch = existingLists.find((l) => l.id === result.id);
            if (localMatch) {
              setError(
                localMatch.shareCode === trimmed
                  ? t("subscribeErrorOwnList")
                  : t("subscribeErrorAlreadySubscribed"),
              );
              return;
            }
            setPreview(result);
          })
          .catch((e) => setError(e instanceof Error ? e.message : String(e)))
          .finally(() => setIsLoading(false));
      }, 100);
    } else {
      setError(t("invalidShareCode"));
    }
  };

  const handleClose = () => {
    setCode("");
    setError(null);
    setPreview(null);
    setScanning(false);
    onClose();
  };

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        transparent
        onRequestClose={handleClose}
      >
        <View style={styles.overlay}>
          <View style={styles.card}>
            <Text style={styles.title}>{t("subscribeToList")}</Text>

            {!firebaseAvailable && (
              <View style={styles.warningBox}>
                <Icon
                  name="alert-circle-outline"
                  size={18}
                  color={theme.colors.danger}
                />
                <Text style={styles.warningText}>
                  {t("sharingNotAvailable")}
                </Text>
              </View>
            )}

            {firebaseAvailable && (
              <>
                <Text style={styles.label}>{t("enterShareCode")}</Text>
                <View style={styles.inputRow}>
                  <TextInput
                    style={styles.input}
                    value={code}
                    onChangeText={(v) => {
                      setCode(v.toUpperCase());
                      setError(null);
                      setPreview(null);
                    }}
                    placeholder="ABC12345"
                    placeholderTextColor={theme.colors.textMuted}
                    autoCapitalize="characters"
                    maxLength={8}
                    returnKeyType="search"
                    onSubmitEditing={handleLookup}
                  />
                  <IconButton
                    icon="qrcode-scan"
                    variant="filled"
                    size={theme.iconSize.md}
                    onPress={handleScanPress}
                    accessibilityLabel={t("scanQrCode")}
                    style={styles.lookupButton}
                  />
                  <IconButton
                    icon="magnify"
                    variant="filled"
                    size={theme.iconSize.md}
                    onPress={handleLookup}
                    disabled={code.trim().length !== 8 || isLoading}
                    accessibilityLabel={t("lookUpList")}
                    style={styles.lookupButton}
                  />
                </View>

                {error && <Text style={styles.errorText}>{error}</Text>}

                {isLoading && (
                  <ActivityIndicator
                    size="small"
                    color={theme.colors.primary}
                    style={styles.spinner}
                  />
                )}

                {preview && (
                  <View style={styles.previewBox}>
                    <Icon
                      name="cloud-check-outline"
                      size={20}
                      color={theme.colors.success}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.previewName}>{preview.name}</Text>
                      <Text style={styles.previewMeta}>
                        {preview.patterns.length} {t("patterns")}
                      </Text>
                    </View>
                  </View>
                )}
              </>
            )}

            <View style={styles.buttonRow}>
              <Button
                title={t("cancel")}
                variant="secondary"
                onPress={handleClose}
                style={styles.footerButton}
              />
              {firebaseAvailable && (
                <Button
                  title={t("subscribeConfirm")}
                  onPress={handleConfirm}
                  disabled={!preview}
                  style={styles.footerButton}
                />
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* ── QR code scanner ───────────────────────────────────────────── */}
      <QrCodeScanner
        visible={scanning}
        hint={t("scanQrCodeHint")}
        onScanned={handleBarCodeScanned}
        onClose={() => setScanning(false)}
      />
    </>
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
    marginBottom: theme.space.lg,
  },
  label: {
    ...theme.typography.label,
    color: theme.colors.textMuted,
    marginBottom: theme.space.sm,
  },
  inputRow: {
    flexDirection: "row",
    gap: theme.space.md,
    marginBottom: theme.space.sm,
  },
  input: {
    ...theme.typography.headline,
    flex: 1,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.space.lg,
    paddingVertical: theme.space.md,
    letterSpacing: 3,
    color: theme.colors.text,
  },
  lookupButton: {
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
  previewBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.space.md,
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: theme.radius.md,
    padding: theme.space.md,
    marginTop: theme.space.sm,
    marginBottom: theme.space.xs,
  },
  previewName: {
    ...theme.typography.label,
    color: theme.colors.text,
  },
  previewMeta: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
  warningBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.space.sm,
    backgroundColor: alpha(theme.colors.danger, 0.08),
    borderRadius: theme.radius.md,
    padding: theme.space.md,
    marginBottom: theme.space.lg,
  },
  warningText: {
    ...theme.typography.bodySmall,
    flex: 1,
    color: theme.colors.danger,
  },
  buttonRow: {
    flexDirection: "row",
    gap: theme.space.md,
    marginTop: theme.space.xl,
  },
  footerButton: { flex: 1 },
}));

export default SubscribeListModal;
