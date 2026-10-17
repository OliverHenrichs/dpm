import React, { useState } from "react";
import { Clipboard, Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import { IconButton } from "@/src/common/ui";

interface ShareableCodeProps {
  code: string;
  /** What the copy button says to a screen reader ("Copy share code"). */
  copyLabel: string;
  /** The large type of a share code; a longer code (a handover's) takes the smaller one. */
  large?: boolean;
}

/**
 * A code someone passes on to another phone: the code itself, a copy button that ticks for two
 * seconds, and a QR code to scan, shown on request. A share code and a handover code.
 */
const ShareableCode: React.FC<ShareableCodeProps> = ({
  code,
  copyLabel,
  large = false,
}) => {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);

  const handleCopy = () => {
    Clipboard.setString(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <View style={styles.codeRow}>
        <Text style={styles.code(large)} selectable>
          {code}
        </Text>
        <IconButton
          icon={copied ? "check" : "content-copy"}
          size={theme.iconSize.md}
          color={copied ? "success" : "primary"}
          onPress={handleCopy}
          accessibilityLabel={copyLabel}
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
            value={code}
            size={160}
            color={theme.colors.text}
            backgroundColor={theme.colors.surface}
          />
        </View>
      )}
    </>
  );
};

const styles = StyleSheet.create((theme) => ({
  codeRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.space.lg,
    paddingVertical: theme.space.md,
  },
  code: (large: boolean) => ({
    ...(large ? theme.typography.display : theme.typography.headline),
    flex: 1,
    letterSpacing: large ? 4 : 3,
    color: theme.colors.primary,
    fontVariant: ["tabular-nums"],
  }),
  qrContainer: {
    alignItems: "center",
    paddingVertical: theme.space.lg,
  },
}));

export default ShareableCode;
