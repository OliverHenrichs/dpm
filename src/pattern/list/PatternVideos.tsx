import React from "react";
import { Image, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { alpha } from "@/src/common/theme/tokens";
import { useTranslation } from "react-i18next";
import {
  getCommonAddButtonContainer,
  getCommonLabel,
  getCommonPrereqContainer,
  getCommonRow,
} from "@/src/common/utils/CommonStyles";
import PlusButton from "@/src/common/components/PlusButton";
import { Icon } from "@/src/common/ui/Icon";
import { IVideoReference } from "@/src/pattern/types/IPatternList";
import { formatTime } from "@/src/common/utils/TImeUtils";

export type PatternVideosProps = {
  videoRefs: IVideoReference[];
  thumbnails: string[];
  onAddVideo: () => void;
  onRemoveVideo: (index: number) => void;
  /** Offers editing a video (shorten, de-identify) next to '+'; omitted where that cannot run. */
  onEditVideo?: () => void;
  disabled?: boolean;
};

const PatternVideos: React.FC<PatternVideosProps> = ({
  videoRefs,
  thumbnails,
  onAddVideo,
  onRemoveVideo,
  onEditVideo,
  disabled = false,
}) => {
  const { theme } = useUnistyles();
  const { t } = useTranslation();

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
              <View>
                <Image
                  source={{ uri: thumb }}
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 8,
                    resizeMode: "cover",
                  }}
                />
                {ref.generated && (
                  <View style={styles.urlBadge}>
                    <Text style={styles.urlBadgeText}>
                      {t("videoBadgeSilhouette")}
                    </Text>
                  </View>
                )}
              </View>
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
        {onEditVideo && (
          <TouchableOpacity
            onPress={onEditVideo}
            style={styles.iconButton}
            accessibilityRole="button"
            accessibilityLabel={t("videoEditA11y")}
          >
            <Icon name="movie-edit" size={28} color={theme.colors.success} />
          </TouchableOpacity>
        )}
        <PlusButton
          onPress={onAddVideo}
          accessibilityLabel={t("add")}
          disabled={disabled}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create((theme) => {
  return {
    prereqContainer: {
      ...getCommonPrereqContainer(theme),
      position: "relative",
    },
    label: { ...getCommonLabel(theme) },
    videosRow: { ...getCommonRow(), gap: theme.space.xs },
    videosInputRow: {
      ...getCommonRow(),
      minHeight: 64,
      height: 78,
    },
    thumbnailWrapper: {
      position: "relative",
      marginTop: theme.space.sm,
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
      borderRadius: theme.radius.md,
      backgroundColor: alpha(theme.colors.primary, 0.2),
      borderWidth: 1,
      borderColor: theme.colors.primary,
      justifyContent: "center",
      alignItems: "center",
      padding: theme.space.xs,
    },
    urlPlaceholderIcon: {
      fontSize: theme.iconSize.md,
    },
    urlPlaceholderText: {
      ...theme.typography.badge,
      color: theme.colors.text,
      textAlign: "center",
      marginTop: theme.space.xxs,
    },
    urlBadge: {
      position: "absolute",
      bottom: 4,
      right: 0,
      backgroundColor: theme.media.scrim,
      borderRadius: theme.radius.xs,
      paddingHorizontal: theme.space.xs,
      paddingVertical: 1,
    },
    urlBadgeText: {
      ...theme.typography.badge,
      color: theme.media.onScrim,
      fontWeight: "bold",
    },
    removeButton: {
      position: "absolute",
      top: -8,
      right: -8,
      backgroundColor: theme.colors.danger,
      borderRadius: 10,
      width: 20,
      height: 20,
      justifyContent: "center",
      alignItems: "center",
      zIndex: 2,
    },
    removeButtonText: {
      ...theme.typography.label,
      color: theme.colors.onDanger,
      fontWeight: "bold",
      lineHeight: 18,
    },
    addButtonContainer: {
      ...getCommonAddButtonContainer(),
      ...getCommonRow(),
      gap: theme.space.xs,
    },
    iconButton: { padding: 1, borderRadius: theme.radius.xl },
  };
});

export default PatternVideos;
