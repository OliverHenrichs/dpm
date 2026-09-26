import React from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useThemeContext } from "@/src/common/components/ThemeContext";
import { getPalette, PaletteColor } from "@/src/common/utils/ColorPalette";
import DeidentifyTrimPanel from "@/src/deidentify/components/DeidentifyTrimPanel";
import { useDeidentifyJobs } from "@/src/deidentify/jobs/DeidentifyJobsContext";
import { SCREEN_EDGE_INSET } from "@/src/common/utils/EdgeInsets";
import { ALL_PROVIDERS } from "@/src/deidentify/providers/allProviders";
import { availableProviders } from "@/src/deidentify/providers/registry";

export type DeidentifyTarget = {
  listId: string;
  /** For the progress line; the job finds the video by [sourceUri]. */
  patternName: string;
  sourceUri: string;
};

type Props = {
  /** What to de-identify; null hides the modal. */
  target: DeidentifyTarget | null;
  onClose: () => void;
};

/**
 * Trim, tap the dancers, start. The run itself becomes a background job (it takes minutes), so
 * this closes as soon as it is started; the job replaces the video in the pattern when done.
 */
const DeidentifyModal: React.FC<Props> = ({ target, onClose }) => {
  const { t } = useTranslation();
  const { colorScheme } = useThemeContext();
  const palette = getPalette(colorScheme);
  const { start } = useDeidentifyJobs();
  const styles = getStyles(palette);

  return (
    <Modal
      visible={target !== null}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title} numberOfLines={1}>
              {t("deidentifyTitle")}
              {target ? ` — ${target.patternName}` : ""}
            </Text>
            <TouchableOpacity
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t("cancel")}
            >
              <Text style={styles.close}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView>
            {target && (
              <DeidentifyTrimPanel
                key={target.sourceUri}
                sourceUri={target.sourceUri}
                providers={availableProviders(ALL_PROVIDERS)}
                onRun={(provider, request) => {
                  start({
                    listId: target.listId,
                    patternName: target.patternName,
                    provider,
                    request,
                  });
                  onClose();
                }}
              />
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const getStyles = (palette: Record<PaletteColor, string>) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: "flex-end",
      backgroundColor: palette[PaletteColor.ModalOverlay],
    },
    card: {
      maxHeight: "92%",
      padding: 16,
      // The trim bar is dragged sideways: keep it out of Android's back-gesture band, which a
      // full-width sheet does not do on its own (it is not inside PageContainer).
      paddingHorizontal: SCREEN_EDGE_INSET + 16,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      backgroundColor: palette[PaletteColor.Background],
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 12,
      gap: 8,
    },
    title: {
      flex: 1,
      fontSize: 18,
      fontWeight: "bold",
      color: palette[PaletteColor.PrimaryText],
    },
    close: {
      fontSize: 20,
      color: palette[PaletteColor.SecondaryText],
      padding: 4,
    },
  });

export default DeidentifyModal;
