import React from "react";
import { Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import { Tappable } from "@/src/common/ui";
import { Icon, type IconName } from "@/src/common/ui/Icon";

interface ListSharingBandProps {
  /** The list owner's band says _Published_, a follower's _Following_. */
  role: "owner" | "follower";
  /** A members-only list's people: those asking to join, and the members sheet. */
  members?: { waiting: number; onPress: () => void };
  /** Suggestions waiting for the owner's review. */
  suggestions?: { count: number; onPress: () => void };
  /** A follower suggesting a figure. */
  onSuggest?: () => void;
}

/**
 * What a published list's followers and its owner do with each other, above the List tab's
 * segments so it is the same on Figures, Modifiers and Sequences: the owner's members and
 * suggestions, with what is waiting in words, or a follower's _Suggest a figure_. It renders
 * nothing when there is no such action, so an unpublished list has no band.
 */
const ListSharingBand: React.FC<ListSharingBandProps> = ({
  role,
  members,
  suggestions,
  onSuggest,
}) => {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  if (!members && !suggestions && !onSuggest) return null;

  return (
    <View style={styles.band}>
      <View style={styles.status}>
        <Icon
          name="broadcast"
          size={theme.iconSize.sm}
          color={theme.colors.textMuted}
        />
        <Text style={styles.statusText} numberOfLines={1}>
          {t(role === "owner" ? "listPublished" : "listFollowing")}
        </Text>
      </View>
      <View style={styles.actions}>
        {members && (
          <BandAction
            icon={
              members.waiting > 0 ? "account-group" : "account-group-outline"
            }
            label={t(members.waiting > 0 ? "membersRequested" : "membersRow")}
            count={members.waiting}
            onPress={members.onPress}
            accessibilityLabel={t("membersButtonLabel", {
              count: members.waiting,
            })}
          />
        )}
        {suggestions && (
          <BandAction
            icon={
              suggestions.count > 0 ? "lightbulb-on" : "lightbulb-on-outline"
            }
            label={t("suggestionsSection")}
            count={suggestions.count}
            onPress={suggestions.onPress}
            accessibilityLabel={t("suggestionsReviewLabel", {
              count: suggestions.count,
            })}
          />
        )}
        {onSuggest && (
          <BandAction
            icon="lightbulb-on-outline"
            label={t("suggestPattern")}
            onPress={onSuggest}
            accessibilityLabel={t("suggestPattern")}
          />
        )}
      </View>
    </View>
  );
};

interface BandActionProps {
  icon: IconName;
  label: string;
  /** Shown as a number before the label when there is something waiting. */
  count?: number;
  onPress: () => void;
  accessibilityLabel: string;
}

const BandAction: React.FC<BandActionProps> = ({
  icon,
  label,
  count = 0,
  onPress,
  accessibilityLabel,
}) => {
  const { theme } = useUnistyles();
  return (
    <Tappable
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      style={styles.action}
      hitSlop={{ top: 8, bottom: 8 }}
    >
      <Icon name={icon} size={theme.iconSize.md} color={theme.colors.primary} />
      {count > 0 && (
        <View style={styles.count}>
          <Text style={styles.countText}>{count > 99 ? "99+" : count}</Text>
        </View>
      )}
      <Text style={styles.actionText} numberOfLines={1}>
        {label}
      </Text>
    </Tappable>
  );
};

const styles = StyleSheet.create((theme) => ({
  band: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    columnGap: theme.space.md,
    rowGap: theme.space.xs,
    marginHorizontal: theme.space.sm,
    marginBottom: theme.space.sm,
    paddingVertical: theme.space.xs,
    paddingHorizontal: theme.space.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceVariant,
  },
  status: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.space.xs,
    flexGrow: 1,
  },
  statusText: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    columnGap: theme.space.md,
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.space.xs,
    paddingVertical: theme.space.xs,
  },
  count: {
    minWidth: theme.space.lg,
    paddingHorizontal: theme.space.xxs,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
  },
  countText: {
    ...theme.typography.caption,
    color: theme.colors.onPrimary,
    fontWeight: "700",
  },
  actionText: {
    ...theme.typography.label,
    color: theme.colors.primary,
  },
}));

export default ListSharingBand;
