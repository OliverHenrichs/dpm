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
  const meta = [type?.slug, pattern.level ? t(pattern.level) : undefined]
    .filter(Boolean)
    .join(" · ");

  return (
    <View
      style={[styles.patternItem, isSelected && styles.patternItemSelected]}
    >
      <ListRow
        title={pattern.name}
        strong
        leading={<TypeMarker slug={type?.slug} color={type?.color} />}
        subtitle={
          <View style={styles.metaLine}>
            {!!meta && (
              <Text style={styles.metaText} numberOfLines={1}>
                {meta}
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
 * The pattern's type at a glance: a dot in After Hours, a lettered tile in Clipboard
 * (`theme.list.typeMarker`). The colour is the user's, so the letter picks black or white.
 */
const TypeMarker: React.FC<{ slug?: string; color?: string }> = ({
  slug,
  color,
}) => {
  const { theme } = useUnistyles();
  const fill = color ?? theme.colors.borderStrong;
  if (theme.list.typeMarker === "dot") {
    return <View style={styles.dot(fill)} />;
  }
  return (
    <View style={styles.tile(fill)}>
      <Text
        style={styles.tileLetter(
          prefersDarkText(fill) ? theme.media.black : theme.media.onScrim,
        )}
      >
        {(slug?.[0] ?? "·").toUpperCase()}
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
  dot: (color: string) => ({
    width: theme.space.md,
    height: theme.space.md,
    borderRadius: theme.radius.pill,
    backgroundColor: color,
  }),
  tile: (color: string) => ({
    width: theme.space.xxl,
    height: theme.space.xxxl,
    borderRadius: theme.radius.xs,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color,
  }),
  tileLetter: (color: string) => ({
    ...theme.typography.micro,
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
