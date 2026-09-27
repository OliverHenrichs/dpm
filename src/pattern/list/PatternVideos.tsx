import React from "react";
import { Image, ScrollView, Text, View } from "react-native";
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
import { Icon, IconButton, Tappable } from "@/src/common/ui";
import { IVideoReference } from "@/src/pattern/types/IPatternList";
import { formatTime } from "@/src/common/utils/TImeUtils";

export type PatternVideosProps = {
  videoRefs: IVideoReference[];
  thumbnails: string[];
  onAddVideo: () => void;
  onRemoveVideo: (index: number) => void;
  /** Offers editing a video (shorten, de-identify) next to '+'; omitted where that cannot run. */
  onEditVideo?: () => void;
  /** Opens a video's transcript (L4); its thumbnail is pressable once it has one. */
  onOpenTranscript?: (index: number) => void;
  disabled?: boolean;
};

const PatternVideos: React.FC<PatternVideosProps> = ({
  videoRefs,
  thumbnails,
  onAddVideo,
  onRemoveVideo,
  onEditVideo,
  onOpenTranscript,
  disabled = false,
}) => {
  const { theme } = useUnistyles();
  const { t } = useTranslation();

  const renderThumbnails = () => {
    if (videoRefs.length === 0) return null;
    return videoRefs.map((ref, idx) => {
      const thumb = thumbnails[idx] ?? "";
      const isUrl = ref.type === "url";
      const preview = thumb ? (
        <View>
          <Image source={{ uri: thumb }} style={styles.thumbImage} />
          {isUrl ? (
            <View style={styles.badge}>
              <Icon
                name="youtube"
                size={theme.iconSize.sm}
                color={theme.media.onScrim}
              />
            </View>
          ) : (
            ref.generated && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {t("videoBadgeSilhouette")}
                </Text>
              </View>
            )
          )}
        </View>
      ) : isUrl ? (
        <View style={styles.urlPlaceholder}>
          <Icon
            name="link-variant"
            size={theme.iconSize.md}
            color={theme.colors.primary}
          />
          <Text style={styles.urlPlaceholderText} numberOfLines={2}>
            {ref.startTime != null
              ? formatTime(ref.startTime)
              : t("onlineVideo")}
          </Text>
        </View>
      ) : (
        <Text style={styles.label}>{t("noThumbnail")}</Text>
      );
      return (
        <View key={idx} style={styles.thumbnailWrapper}>
          {/* A transcribed video (L4) opens its transcript, thumbnail or not. */}
          {ref.transcript && onOpenTranscript ? (
            <Tappable
              onPress={() => onOpenTranscript(idx)}
              accessibilityLabel={t("transcriptOpenN", { n: idx + 1 })}
            >
              {preview}
            </Tappable>
          ) : (
            preview
          )}
          {ref.transcript && (
            <View style={styles.transcriptBadge} pointerEvents="none">
              <Icon
                name="text-box-outline"
                size={theme.iconSize.sm}
                color={theme.media.onScrim}
              />
            </View>
          )}
          {/* A bare "×" told a screen reader nothing about what it removes. */}
          <IconButton
            icon="close"
            variant="filled"
            color="danger"
            size={theme.iconSize.sm - 2}
            onPress={() => onRemoveVideo(idx)}
            accessibilityLabel={t("removeVideo")}
            style={styles.removeButton}
          />
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
          <IconButton
            icon="movie-edit"
            color="success"
            size={28}
            onPress={onEditVideo}
            accessibilityLabel={t("videoEditA11y")}
          />
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

/** Thumbnail edge, in dp: small enough for three in a row beside the add button. */
const THUMB = 64;

const styles = StyleSheet.create((theme) => ({
  prereqContainer: {
    ...getCommonPrereqContainer(theme),
    position: "relative",
  },
  label: { ...getCommonLabel(theme) },
  videosRow: { ...getCommonRow(), gap: theme.space.xs },
  videosInputRow: {
    ...getCommonRow(),
    minHeight: THUMB,
    height: THUMB + theme.space.md + 2,
  },
  thumbnailWrapper: {
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
    width: THUMB,
    marginTop: theme.space.sm,
    marginRight: theme.space.xs,
  },
  thumbImage: {
    width: THUMB,
    height: THUMB,
    borderRadius: theme.radius.md,
    resizeMode: "cover",
  },
  urlPlaceholder: {
    width: THUMB,
    height: THUMB,
    borderRadius: theme.radius.md,
    backgroundColor: alpha(theme.colors.primary, 0.2),
    borderWidth: 1,
    borderColor: theme.colors.primary,
    justifyContent: "center",
    alignItems: "center",
    padding: theme.space.xs,
  },
  urlPlaceholderText: {
    ...theme.typography.badge,
    color: theme.colors.text,
    textAlign: "center",
    marginTop: theme.space.xxs,
  },
  badge: {
    position: "absolute",
    bottom: theme.space.xs,
    right: theme.space.xxs,
    backgroundColor: theme.media.scrim,
    borderRadius: theme.radius.xs,
    paddingHorizontal: theme.space.xs,
    paddingVertical: 1,
  },
  transcriptBadge: {
    position: "absolute",
    top: theme.space.xs,
    left: theme.space.xxs,
    backgroundColor: theme.media.scrim,
    borderRadius: theme.radius.xs,
    padding: theme.space.xxs,
  },
  badgeText: {
    ...theme.typography.badge,
    color: theme.media.onScrim,
    fontWeight: "bold",
  },
  removeButton: {
    position: "absolute",
    top: -theme.space.sm,
    right: -theme.space.sm,
    zIndex: 2,
  },
  addButtonContainer: {
    ...getCommonAddButtonContainer(),
    ...getCommonRow(),
    gap: theme.space.xs,
  },
}));

export default PatternVideos;
