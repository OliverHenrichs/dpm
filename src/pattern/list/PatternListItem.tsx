import React, { useState } from "react";
import { Text, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { Icon, IconButton, ListRow } from "@/src/common/ui";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { IModifier, IPattern } from "@/src/pattern/types/IPatternList";
import { PatternType } from "@/src/pattern/types/PatternType";
import PatternDetails from "@/src/pattern/graph/PatternDetails";
import AppDialog from "@/src/common/components/AppDialog";
import { useTranslation } from "react-i18next";
import { prefersDarkText } from "@/src/common/theme/contrast";

interface PatternListItemProps {
  pattern: IPattern;
  allPatterns: IPattern[];
  patternTypes?: PatternType[];
  modifiers?: IModifier[];
  isReadonly?: boolean;
  isSelected: boolean;
  onSelect: (pattern: IPattern | undefined) => void;
  onEdit: (pattern: IPattern) => void;
  onDelete: (id?: number) => void;
}

const PatternListItem: React.FC<PatternListItemProps> = ({
  pattern,
  allPatterns,
  patternTypes,
  modifiers,
  isReadonly,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
}) => {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  const handleToggleSelect = () => {
    if (isSelected) {
      onSelect(undefined);
    } else {
      onSelect(pattern);
    }
  };

  const type = patternTypes?.find((pt) => pt.id === pattern.typeId);
  // Every video of the pattern, its own and those of it with a modifier.
  const videoCount =
    pattern.videoRefs.length +
    (pattern.modifierRefs ?? []).reduce(
      (sum, ref) => sum + ref.videoRefs.length,
      0,
    );
  // The overview names what a pattern is; counts and the rest wait in the opened row.
  const level = pattern.level ? t(pattern.level) : undefined;

  return (
    <View
      style={[styles.patternItem, isSelected && styles.patternItemSelected]}
    >
      <ListRow
        title={pattern.name}
        strong
        subtitle={
          <View style={styles.metaLine}>
            {type && <TypeLabel slug={type.slug} color={type.color} />}
            {!!level && (
              <Text style={styles.metaText} numberOfLines={1}>
                {type ? `· ${level}` : level}
              </Text>
            )}
            {videoCount > 0 && (
              <View
                style={styles.videoCount}
                accessible
                accessibilityLabel={t("videosCountA11y", { n: videoCount })}
              >
                <Icon
                  name="play-circle-outline"
                  size={theme.iconSize.sm}
                  color={theme.colors.textMuted}
                />
                <Text style={styles.metaText}>{videoCount}</Text>
              </View>
            )}
          </View>
        }
        expanded={isSelected}
        onPress={handleToggleSelect}
        accessibilityHint={t("selectPattern")}
        trailing={
          !isReadonly && (
            <>
              <IconButton
                icon="pencil"
                size={theme.iconSize.md}
                onPress={() => onEdit(pattern)}
                accessibilityLabel={t("editPattern")}
              />
              <IconButton
                icon="trash-can-outline"
                size={theme.iconSize.md}
                color="danger"
                onPress={() => setShowConfirmDelete(true)}
                accessibilityLabel={t("deletePattern")}
              />
            </>
          )
        }
      />
      {isSelected && (
        <Animated.View
          style={styles.details}
          entering={FadeIn.duration(theme.motion.duration.normal)}
          exiting={FadeOut.duration(theme.motion.duration.fast)}
        >
          <PatternDetails
            selectedPattern={pattern}
            patterns={allPatterns}
            patternTypes={patternTypes}
            modifiers={modifiers}
          />
        </Animated.View>
      )}
      <AppDialog
        visible={showConfirmDelete}
        title={t("deletePattern")}
        message={t("deletePatternConfirm", { name: pattern.name })}
        closeLabel={t("cancel")}
        onClose={() => setShowConfirmDelete(false)}
        confirmLabel={t("delete")}
        confirmDestructive
        onConfirm={() => {
          setShowConfirmDelete(false);
          onDelete(pattern.id);
        }}
      />
    </View>
  );
};

/**
 * The pattern's type, named and in its colour: a dot before the name in After Hours, a filled
 * tag in Clipboard (`theme.list.typeLabel`). The colour is the user's, so the tag's text picks
 * black or white.
 */
const TypeLabel: React.FC<{ slug: string; color: string }> = ({
  slug,
  color,
}) => {
  const { theme } = useUnistyles();
  if (theme.list.typeLabel === "dot") {
    return (
      <View style={styles.typeDotLabel}>
        <View style={styles.dot(color)} />
        <Text style={styles.metaText} numberOfLines={1}>
          {slug}
        </Text>
      </View>
    );
  }
  return (
    <View style={styles.tag(color)}>
      <Text
        style={styles.tagText(
          prefersDarkText(color) ? theme.media.black : theme.media.onScrim,
        )}
        numberOfLines={1}
      >
        {slug}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
  patternItem: {
    overflow: "hidden",
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    marginBottom: theme.list.rowGap,
    borderColor: theme.colors.surface,
    backgroundColor: theme.colors.surface,
  },
  metaLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.space.sm,
  },
  metaText: {
    ...theme.typography.caption,
    flexShrink: 1,
    color: theme.colors.textMuted,
  },
  videoCount: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.space.xxs,
  },
  typeDotLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.space.xs,
    flexShrink: 1,
  },
  dot: (color: string) => ({
    width: theme.space.sm,
    height: theme.space.sm,
    borderRadius: theme.radius.pill,
    backgroundColor: color,
  }),
  tag: (color: string) => ({
    flexShrink: 1,
    paddingHorizontal: theme.space.xs,
    paddingVertical: theme.space.xxs,
    borderRadius: theme.radius.xs,
    backgroundColor: color,
  }),
  tagText: (color: string) => ({
    ...theme.typography.badge,
    color,
  }),
  patternItemSelected: {
    borderColor: theme.colors.primary,
  },
  details: {
    paddingHorizontal: theme.space.md,
    paddingBottom: theme.space.md,
  },
}));

export default PatternListItem;
