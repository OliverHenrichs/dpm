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
import { Button, Icon, Tappable } from "@/src/common/ui";
import { IVideoReference } from "@/src/pattern/types/IPatternList";
import { formatTime } from "@/src/common/utils/TImeUtils";
import { MAX_VIDEOS } from "@/src/anonymize/jobs/replaceVideo";

export type PatternVideosProps = {
  videoRefs: IVideoReference[];
  thumbnails: string[];
  onAddVideo: () => void;
  onRemoveVideo: (index: number) => void;
  /**
   * Offers editing a video (shorten, anonymize, transcribe) as a labelled button next to '+';
   * omitted where that cannot run.
   */
  onEditVideo?: () => void;
  /** Edits one video, from a button on its thumbnail; only videos saved on the phone get one. */
  onEditVideoAt?: (index: number) => void;
  /** Opens a video's transcript (L4); its thumbnail is pressable once it has one. */
  onOpenTranscript?: (index: number) => void;
  disabled?: boolean;
  /** At the most videos it can hold: '+' is disabled, and a line says why. */
  full?: boolean;
};

const PatternVideos: React.FC<PatternVideosProps> = ({
  videoRefs,
  thumbnails,
  onAddVideo,
  onRemoveVideo,
  onEditVideo,
  onEditVideoAt,
  onOpenTranscript,
  disabled = false,
  full = false,
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
            // An icon, not the word: no language's word for it fits beside the edit button.
            ref.generated && (
              <View
                style={styles.badge}
                accessible
                accessibilityLabel={t("videoBadgeSilhouette")}
              >
                <Icon
                  name="incognito"
                  size={theme.iconSize.sm}
                  color={theme.media.onScrim}
                />
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
        <View style={styles.noPreview}>
          <Text style={styles.label}>{t("noThumbnail")}</Text>
        </View>
      );
      return (
        <View key={idx} style={styles.tile}>
          <View style={styles.thumbnailWrapper}>
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
          </View>
          {/*
            The actions sit in a bar under the picture, each a full touch target. They used to
            be small discs inside the picture's corners, whose grown touch areas overlapped each
            other and the picture, and were cut off by the scroller's edges.
          */}
          <View style={styles.actionBar}>
            {onEditVideoAt && ref.type === "local" && (
              <Tappable
                onPress={() => onEditVideoAt(idx)}
                accessibilityLabel={t("videoEditN", { n: idx + 1 })}
                style={styles.action}
              >
                <Icon
                  name="movie-edit"
                  size={theme.iconSize.md}
                  color={theme.colors.primary}
                />
              </Tappable>
            )}
            <Tappable
              onPress={() => onRemoveVideo(idx)}
              accessibilityLabel={t("removeVideo")}
              style={[styles.action, styles.removeAction]}
            >
              <Icon
                name="delete-outline"
                size={theme.iconSize.md}
                color={theme.colors.danger}
              />
            </Tappable>
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
      {full && (
        <Text style={styles.fullHint}>
          {t("videosFullHint", { max: MAX_VIDEOS })}
        </Text>
      )}
      <View style={styles.addButtonContainer}>
        {onEditVideo && (
          <Button
            title={t("videoEditTitle")}
            icon="movie-edit"
            variant="secondary"
            size="sm"
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

/**
 * A video's tile, in dp: wide enough for two full touch targets side by side in its action bar,
 * and still three tiles to a phone's width.
 */
const TILE_WIDTH = 96;
const THUMB_HEIGHT = 64;

/*
 * On the picture: transcript top left, what kind of video bottom right, both inside its corners
 * (Android clips a ScrollView's content to its bounds). The actions are in the bar below it.
 */

const styles = StyleSheet.create((theme) => ({
  prereqContainer: {
    ...getCommonPrereqContainer(theme),
    position: "relative",
  },
  label: { ...getCommonLabel(theme) },
  videosRow: { ...getCommonRow(), gap: theme.space.sm },
  videosInputRow: {
    ...getCommonRow(),
    marginTop: theme.space.sm,
  },
  tile: {
    width: TILE_WIDTH,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    overflow: "hidden",
  },
  thumbnailWrapper: {
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    height: THUMB_HEIGHT,
  },
  thumbImage: {
    width: TILE_WIDTH,
    height: THUMB_HEIGHT,
    resizeMode: "cover",
  },
  urlPlaceholder: {
    width: TILE_WIDTH,
    height: THUMB_HEIGHT,
    backgroundColor: alpha(theme.colors.primary, 0.2),
    justifyContent: "center",
    alignItems: "center",
    padding: theme.space.xs,
  },
  noPreview: {
    width: TILE_WIDTH,
    height: THUMB_HEIGHT,
    justifyContent: "center",
    alignItems: "center",
  },
  urlPlaceholderText: {
    ...theme.typography.badge,
    color: theme.colors.text,
    textAlign: "center",
    marginTop: theme.space.xxs,
  },
  badge: {
    position: "absolute",
    bottom: theme.space.xxs,
    right: theme.space.xxs,
    backgroundColor: theme.media.scrim,
    borderRadius: theme.radius.xs,
    padding: theme.space.xxs,
  },
  transcriptBadge: {
    position: "absolute",
    top: theme.space.xxs,
    left: theme.space.xxs,
    backgroundColor: theme.media.scrim,
    borderRadius: theme.radius.xs,
    padding: theme.space.xxs,
  },
  actionBar: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  action: {
    flex: 1,
    height: theme.touchTarget,
    alignItems: "center",
    justifyContent: "center",
  },
  /** Alone (an online video has no edit), remove keeps to the right as it does beside edit. */
  removeAction: { flex: 0, width: theme.touchTarget, marginLeft: "auto" },
  fullHint: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    marginTop: theme.space.xs,
  },
  addButtonContainer: {
    ...getCommonAddButtonContainer(),
    ...getCommonRow(),
    gap: theme.space.xs,
  },
}));

export default PatternVideos;
