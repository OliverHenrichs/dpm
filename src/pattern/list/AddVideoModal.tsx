import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import { PaletteColor } from "@/src/common/utils/ColorPalette";
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
  palette: Record<PaletteColor, string>;
};

const AddVideoModal: React.FC<AddVideoModalProps> = ({
  visible,
  onClose,
  onPickFromLibrary,
  onAddUrl,
  palette,
}) => {
  const { t } = useTranslation();
  const styles = getStyles(palette);

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
      palette={palette}
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
          placeholderTextColor={palette[PaletteColor.TextMuted]}
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
          placeholderTextColor={palette[PaletteColor.TextMuted]}
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

const getStyles = (palette: Record<PaletteColor, string>) => {
  const baseButton = getCommonButton(palette);
  const baseInput = getCommonInput(palette);
  return StyleSheet.create({
    section: {
      marginBottom: 8,
    },
    label: {
      ...getCommonLabel(palette),
      marginBottom: 4,
    },
    input: {
      ...baseInput,
      marginBottom: 8,
    },
    inputError: {
      borderColor: palette[PaletteColor.Danger],
    },
    errorText: {
      color: palette[PaletteColor.Danger],
      fontSize: 12,
      marginBottom: 8,
    },
    libraryButton: {
      ...baseButton,
      alignItems: "center",
    },
    libraryButtonText: {
      color: palette[PaletteColor.OnPrimary],
      fontWeight: "bold",
      fontSize: 15,
    },
    addUrlButton: {
      ...baseButton,
      alignItems: "center",
    },
    addUrlButtonText: {
      color: palette[PaletteColor.OnPrimary],
      fontWeight: "bold",
      fontSize: 15,
    },
    dividerRow: {
      ...getCommonRow(),
      alignItems: "center",
      marginVertical: 12,
      gap: 8,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: palette[PaletteColor.Border],
    },
    dividerText: {
      color: palette[PaletteColor.TextMuted],
      fontSize: 13,
    },
  });
};

export default AddVideoModal;
