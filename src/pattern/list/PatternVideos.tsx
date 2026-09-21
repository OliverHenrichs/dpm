import React from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { PaletteColor } from "@/src/common/utils/ColorPalette";
import { useTranslation } from "react-i18next";
import {
  getCommonAddButtonContainer,
  getCommonLabel,
  getCommonPrereqContainer,
  getCommonRow,
} from "@/src/common/utils/CommonStyles";
import PlusButton from "@/src/common/components/PlusButton";
import { IVideoReference } from "@/src/pattern/types/IPatternList";
import { formatTime } from "@/src/common/utils/TImeUtils";

export type PatternVideosProps = {
  videoRefs: IVideoReference[];
  thumbnails: string[];
  onAddVideo: () => void;
  onRemoveVideo: (index: number) => void;
  palette: Record<PaletteColor, string>;
  disabled?: boolean;
};

const PatternVideos: React.FC<PatternVideosProps> = ({
  videoRefs,
  thumbnails,
  onAddVideo,
  onRemoveVideo,
  palette,
  disabled = false,
}) => {
  const { t } = useTranslation();
  const styles = getStyles(palette);

  const renderThumbnails = () => {
    if (videoRefs.length === 0) return null;
    return videoRefs.map((ref, idx) => {
      const thumb = thumbnails[idx] ?? "";
      const isUrl = ref.type === "url";
      return (
        <View key={idx} style={styles.thumbnailWrapper}>
          <View style={styles.thumbnailContainer}>
            {isUrl && thumb ? (
              // YouTube (or other URL) with a generated thumbnail image
              <View style={styles.thumbnailContainer}>
                <Image
                  source={{ uri: thumb }}
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 8,
                    resizeMode: "cover",
                  }}
                />
                <View style={styles.urlBadge}>
                  <Text style={styles.urlBadgeText}>▶ YT</Text>
                </View>
              </View>
            ) : isUrl ? (
              <View style={styles.urlPlaceholder}>
                <Text style={styles.urlPlaceholderIcon}>🔗</Text>
                <Text style={styles.urlPlaceholderText} numberOfLines={2}>
                  {ref.startTime != null
                    ? `${formatTime(ref.startTime)}`
                    : t("onlineVideo")}
                </Text>
              </View>
            ) : thumb ? (
              <Image
                source={{ uri: thumb }}
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 8,
                  resizeMode: "cover",
                }}
              />
            ) : (
              <Text style={styles.label}>{t("noThumbnail")}</Text>
            )}
            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => onRemoveVideo(idx)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              // A bare "×" tells a screen reader nothing about what it removes.
              accessibilityLabel={t("removeVideo")}
            >
              <Text style={styles.removeButtonText}>×</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    });
  };

  return (
    <View style={styles.prereqContainer}>
      <Text style={styles.label}>{t("videos")}</Text>
      <View style={styles.videosInputRow}>
        <ScrollView
          horizontal
          contentContainerStyle={styles.videosRow}
          showsHorizontalScrollIndicator={false}
        >
          {renderThumbnails()}
        </ScrollView>
      </View>
      <View style={styles.addButtonContainer}>
        <PlusButton
          onPress={onAddVideo}
          palette={palette}
          accessibilityLabel={t("add")}
          disabled={disabled}
        />
      </View>
    </View>
  );
};

const getStyles = (palette: Record<PaletteColor, string>) => {
  return StyleSheet.create({
    prereqContainer: {
      ...getCommonPrereqContainer(palette),
      position: "relative",
    },
    label: { ...getCommonLabel(palette) },
    videosRow: { ...getCommonRow(), gap: 4 },
    videosInputRow: {
      ...getCommonRow(),
      minHeight: 64,
      height: 78,
    },
    thumbnailWrapper: {
      position: "relative",
      marginTop: 8,
    },
    thumbnailContainer: {
      position: "relative",
      justifyContent: "center",
      alignItems: "center",
      width: 64,
    },
    urlPlaceholder: {
      width: 64,
      height: 64,
      borderRadius: 8,
      backgroundColor: palette[PaletteColor.Primary] + "33",
      borderWidth: 1,
      borderColor: palette[PaletteColor.Primary],
      justifyContent: "center",
      alignItems: "center",
      padding: 4,
    },
    urlPlaceholderIcon: {
      fontSize: 20,
    },
    urlPlaceholderText: {
      fontSize: 9,
      color: palette[PaletteColor.PrimaryText],
      textAlign: "center",
      marginTop: 2,
    },
    urlBadge: {
      position: "absolute",
      bottom: 4,
      right: 0,
      backgroundColor: "rgba(0,0,0,0.65)",
      borderRadius: 4,
      paddingHorizontal: 3,
      paddingVertical: 1,
    },
    urlBadgeText: {
      color: "#fff",
      fontSize: 8,
      fontWeight: "bold",
    },
    removeButton: {
      position: "absolute",
      top: -8,
      right: -8,
      backgroundColor: palette[PaletteColor.Error],
      borderRadius: 10,
      width: 20,
      height: 20,
      justifyContent: "center",
      alignItems: "center",
      zIndex: 2,
    },
    removeButtonText: {
      color: "#fff",
      fontWeight: "bold",
      fontSize: 14,
      lineHeight: 18,
    },
    addButtonContainer: getCommonAddButtonContainer(),
  });
};

export default PatternVideos;
