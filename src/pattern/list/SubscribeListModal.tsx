import React, { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { useTranslation } from "react-i18next";
import { getPalette, PaletteColor } from "@/src/common/utils/ColorPalette";
import { useThemeContext } from "@/src/common/components/ThemeContext";
import { fetchSharedList } from "@/src/firebase/FirebaseListService";
import { firebaseAvailable } from "@/src/firebase/firebaseConfig";
import { PatternListWithPatterns } from "@/src/pattern/data/types/IExportData";

interface SubscribeListModalProps {
  visible: boolean;
  onClose: () => void;
  /** Called with the fetched list once the user confirms subscribing. */
  onSubscribe: (list: PatternListWithPatterns) => void;
}

const SubscribeListModal: React.FC<SubscribeListModalProps> = ({
  visible,
  onClose,
  onSubscribe,
}) => {
  const { t } = useTranslation();
  const { colorScheme } = useThemeContext();
  const palette = getPalette(colorScheme);
  const styles = getStyles(palette);

  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PatternListWithPatterns | null>(null);

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
      } else {
        setPreview(result);
      }
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

  const handleClose = () => {
    setCode("");
    setError(null);
    setPreview(null);
    onClose();
  };

  return (
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
                color={palette[PaletteColor.Error]}
              />
              <Text style={styles.warningText}>{t("sharingNotAvailable")}</Text>
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
                  placeholderTextColor={palette[PaletteColor.SecondaryText]}
                  autoCapitalize="characters"
                  maxLength={8}
                  returnKeyType="search"
                  onSubmitEditing={handleLookup}
                />
                <TouchableOpacity
                  style={[
                    styles.lookupButton,
                    code.trim().length !== 8 && styles.lookupButtonDisabled,
                  ]}
                  onPress={handleLookup}
                  disabled={code.trim().length !== 8 || isLoading}
                >
                  <Icon
                    name="magnify"
                    size={20}
                    color={palette[PaletteColor.Surface]}
                  />
                </TouchableOpacity>
              </View>

              {error && <Text style={styles.errorText}>{error}</Text>}

              {isLoading && (
                <ActivityIndicator
                  size="small"
                  color={palette[PaletteColor.Primary]}
                  style={styles.spinner}
                />
              )}

              {preview && (
                <View style={styles.previewBox}>
                  <Icon
                    name="cloud-check-outline"
                    size={20}
                    color={palette[PaletteColor.Accent]}
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
            <TouchableOpacity style={styles.cancelButton} onPress={handleClose}>
              <Text style={styles.cancelButtonText}>{t("cancel")}</Text>
            </TouchableOpacity>
            {firebaseAvailable && (
              <TouchableOpacity
                style={[
                  styles.confirmButton,
                  !preview && styles.confirmButtonDisabled,
                ]}
                onPress={handleConfirm}
                disabled={!preview}
              >
                <Text style={styles.confirmButtonText}>
                  {t("subscribeConfirm")}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
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
      marginBottom: 16,
    },
    label: {
      fontSize: 13,
      fontWeight: "600",
      color: palette[PaletteColor.SecondaryText],
      marginBottom: 8,
    },
    inputRow: {
      flexDirection: "row",
      gap: 10,
      marginBottom: 8,
    },
    input: {
      flex: 1,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: palette[PaletteColor.Border],
      backgroundColor: palette[PaletteColor.Background],
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontSize: 20,
      fontWeight: "bold",
      letterSpacing: 3,
      color: palette[PaletteColor.PrimaryText],
    },
    lookupButton: {
      backgroundColor: palette[PaletteColor.Primary],
      borderRadius: 8,
      paddingHorizontal: 14,
      justifyContent: "center",
      alignItems: "center",
    },
    lookupButtonDisabled: {
      opacity: 0.4,
    },
    errorText: {
      color: palette[PaletteColor.Error],
      fontSize: 13,
      marginBottom: 8,
    },
    spinner: {
      marginVertical: 8,
    },
    previewBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: palette[PaletteColor.TagBg],
      borderRadius: 8,
      padding: 12,
      marginTop: 8,
      marginBottom: 4,
    },
    previewName: {
      fontSize: 15,
      fontWeight: "600",
      color: palette[PaletteColor.PrimaryText],
    },
    previewMeta: {
      fontSize: 12,
      color: palette[PaletteColor.SecondaryText],
    },
    warningBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: palette[PaletteColor.Error] + "15",
      borderRadius: 8,
      padding: 12,
      marginBottom: 16,
    },
    warningText: {
      flex: 1,
      fontSize: 13,
      color: palette[PaletteColor.Error],
    },
    buttonRow: {
      flexDirection: "row",
      gap: 10,
      marginTop: 20,
    },
    cancelButton: {
      flex: 1,
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
    confirmButton: {
      flex: 1,
      backgroundColor: palette[PaletteColor.Primary],
      borderRadius: 8,
      padding: 14,
      alignItems: "center",
    },
    confirmButtonDisabled: {
      opacity: 0.4,
    },
    confirmButtonText: {
      fontSize: 16,
      fontWeight: "600",
      color: palette[PaletteColor.Surface],
    },
  });

export default SubscribeListModal;

