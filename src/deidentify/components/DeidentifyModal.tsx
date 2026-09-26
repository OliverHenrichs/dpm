import React from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useTranslation } from "react-i18next";
import { useThemeContext } from "@/src/common/components/ThemeContext";
import { getPalette, PaletteColor } from "@/src/common/utils/ColorPalette";
import { SCREEN_EDGE_INSET } from "@/src/common/utils/EdgeInsets";
import VideoEditPanel from "@/src/deidentify/components/VideoEditPanel";
import { useDeidentifyJobs } from "@/src/deidentify/jobs/DeidentifyJobsContext";
import { ALL_PROVIDERS } from "@/src/deidentify/providers/allProviders";
import { availableProviders } from "@/src/deidentify/providers/registry";
import { IGeneratedVideo } from "@/src/pattern/types/IPatternList";

export type DeidentifyTarget = {
  listId: string;
  /** For the progress line; the job finds the video by [sourceUri]. */
  patternName: string;
  sourceUri: string;
  /** Set when the video is already de-identified: it can then only be shortened. */
  generated?: IGeneratedVideo;
};

type Props = {
  /** The video to edit; null hides the modal. */
  target: DeidentifyTarget | null;
  onClose: () => void;
};

/**
 * Edit a pattern's video — shorten it, or de-identify part of it. Either runs as a background
 * job (de-identifying takes minutes), so this closes as soon as one is started; the job
 * replaces the video in the pattern when done.
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
      {/* A Modal renders outside the drawer's gesture root, and without one of its own the
          trim bar's pan never activates on Android. See src/pattern/graph/AGENTS.md. */}
      <GestureHandlerRootView style={styles.root}>
        <View style={styles.overlay}>
          <View style={styles.card}>
            <View style={styles.header}>
              <Text style={styles.title} numberOfLines={1}>
                {t("videoEditTitle")}
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
                <VideoEditPanel
                  key={target.sourceUri}
                  sourceUri={target.sourceUri}
                  providers={
                    target.generated ? [] : availableProviders(ALL_PROVIDERS)
                  }
                  onShorten={(request) => {
                    start({
                      kind: "shorten",
                      listId: target.listId,
                      patternName: target.patternName,
                      request,
                      generated: target.generated,
                    });
                    onClose();
                  }}
                  onDeidentify={(provider, request) => {
                    start({
                      kind: "deidentify",
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
      </GestureHandlerRootView>
    </Modal>
  );
};

const getStyles = (palette: Record<PaletteColor, string>) =>
  StyleSheet.create({
    root: { flex: 1 },
    overlay: {
      flex: 1,
      justifyContent: "flex-end",
      backgroundColor: palette[PaletteColor.Overlay],
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
      color: palette[PaletteColor.Text],
    },
    close: {
      fontSize: 20,
      color: palette[PaletteColor.TextMuted],
      padding: 4,
    },
  });

export default DeidentifyModal;
