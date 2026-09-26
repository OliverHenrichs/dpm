import React, { useState } from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import BottomSheet from "@/src/common/components/BottomSheet";
import {
  getCommonButton,
  getCommonInput,
  getCommonLabel,
  getCommonRow,
} from "@/src/common/utils/CommonStyles";

export type AddVideoModalProps = {
  visible: boolean;
  onClose: () => void;
  onPickFromLibrary: () => void;
  onAddUrl: (url: string, startTime?: number) => void;
};

const AddVideoModal: React.FC<AddVideoModalProps> = ({
  visible,
  onClose,
  onPickFromLibrary,
  onAddUrl,
}) => {
  const { theme } = useUnistyles();
  const { t } = useTranslation();

  const [url, setUrl] = useState("");
  const [startTimeText, setStartTimeText] = useState("");
  const [urlError, setUrlError] = useState("");

  const handleClose = () => {
    setUrl("");
    setStartTimeText("");
    setUrlError("");
    onClose();
  };

  const handlePickFromLibrary = () => {
    handleClose();
    onPickFromLibrary();
  };

  const parseStartTime = (text: string): number | undefined => {
    const trimmed = text.trim();
    if (!trimmed) return undefined;
    // Accept "MM:SS" or "H:MM:SS" notation
    const parts = trimmed.split(":").map(Number);
    if (parts.some(isNaN)) return undefined;
    if (parts.length === 1) return parts[0];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return undefined;
  };

  const handleAddUrl = () => {
    const trimmed = url.trim();
    if (!trimmed) {
      setUrlError(t("videoUrlRequired"));
      return;
    }
    // Basic URL validation
    if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
      setUrlError(t("videoUrlInvalid"));
      return;
    }
    const startTime = parseStartTime(startTimeText);
    setUrl("");
    setStartTimeText("");
    setUrlError("");
    onClose();
    onAddUrl(trimmed, startTime);
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={handleClose}
      title={t("addVideo")}
      minHeight="40%"
      maxHeight="70%"
    >
      <View style={styles.section}>
        <TouchableOpacity
          style={styles.libraryButton}
          onPress={handlePickFromLibrary}
        >
          <Text style={styles.libraryButtonText}>
            {"📁  " + t("addFromLibrary")}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>{t("or")}</Text>
        <View style={styles.dividerLine} />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>{t("addFromUrl")}</Text>
        <TextInput
          style={[styles.input, urlError ? styles.inputError : null]}
          placeholder={t("videoUrl")}
          placeholderTextColor={theme.colors.textMuted}
          value={url}
          onChangeText={(text) => {
            setUrl(text);
            if (urlError) setUrlError("");
          }}
          autoCapitalize="none"
          keyboardType="url"
        />
        {!!urlError && <Text style={styles.errorText}>{urlError}</Text>}
        <TextInput
          style={styles.input}
          placeholder={t("startTimePlaceholder")}
          placeholderTextColor={theme.colors.textMuted}
          value={startTimeText}
          onChangeText={setStartTimeText}
          keyboardType="numbers-and-punctuation"
        />
        <TouchableOpacity style={styles.addUrlButton} onPress={handleAddUrl}>
          <Text style={styles.addUrlButtonText}>{"🔗  " + t("addUrl")}</Text>
        </TouchableOpacity>
      </View>
    </BottomSheet>
  );
};

const styles = StyleSheet.create((theme) => {
  const baseButton = getCommonButton(theme);
  const baseInput = getCommonInput(theme);
  return {
    section: {
      marginBottom: theme.space.sm,
    },
    label: {
      ...getCommonLabel(theme),
      marginBottom: theme.space.xs,
    },
    input: {
      ...baseInput,
      marginBottom: theme.space.sm,
    },
    inputError: {
      borderColor: theme.colors.danger,
    },
    errorText: {
      ...theme.typography.caption,
      color: theme.colors.danger,
      marginBottom: theme.space.sm,
    },
    libraryButton: {
      ...baseButton,
      alignItems: "center",
    },
    libraryButtonText: {
      ...theme.typography.label,
      color: theme.colors.onPrimary,
      fontWeight: "bold",
    },
    addUrlButton: {
      ...baseButton,
      alignItems: "center",
    },
    addUrlButtonText: {
      ...theme.typography.label,
      color: theme.colors.onPrimary,
      fontWeight: "bold",
    },
    dividerRow: {
      ...getCommonRow(),
      alignItems: "center",
      marginVertical: theme.space.md,
      gap: theme.space.sm,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: theme.colors.border,
    },
    dividerText: {
      ...theme.typography.bodySmall,
      color: theme.colors.textMuted,
    },
  };
});

export default AddVideoModal;
