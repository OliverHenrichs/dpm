import React from "react";
import { Text, TouchableOpacity } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import SectionHeader from "@/src/common/components/SectionHeader";
import { useTranslation } from "react-i18next";
import { ViewMode } from "@/src/pattern/graph/types/ViewMode";

interface PatternGraphHeaderProps {
  viewMode: ViewMode;
  onToggleView: () => void;
  hasActiveFilter: boolean;
  onFilter: () => void;
  /** Only offered once there is a manual layout to discard. */
  canResetLayout: boolean;
  onResetLayout: () => void;
}

const PatternGraphHeader: React.FC<PatternGraphHeaderProps> = ({
  viewMode,
  onToggleView,
  hasActiveFilter,
  onFilter,
  canResetLayout,
  onResetLayout,
}) => {
  const { t } = useTranslation();
  const { theme } = useUnistyles();

  const rightActions = (
    <>
      {/* Only shown once the user has actually moved something: an always-on
          reset for a layout nobody arranged is a button that does nothing. */}
      {canResetLayout && viewMode === "graph" && (
        <TouchableOpacity
          onPress={onResetLayout}
          style={styles.iconButton}
          accessibilityLabel={t("resetLayout")}
        >
          <Icon name="backup-restore" size={24} color={theme.colors.primary} />
        </TouchableOpacity>
      )}
      {/* Same icon/colour convention as PatternListHeader, so an active
          filter reads the same on both screens. */}
      <TouchableOpacity
        onPress={onFilter}
        style={styles.iconButton}
        accessibilityLabel={t("filterPatterns")}
      >
        <Icon
          name={hasActiveFilter ? "filter" : "filter-outline"}
          size={24}
          color={hasActiveFilter ? theme.colors.success : theme.colors.primary}
        />
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.controlButton}
        onPress={onToggleView}
        accessibilityLabel={t("toggleView")}
      >
        <Icon
          name={viewMode === "timeline" ? "graph" : "timeline"}
          size={15}
          color={theme.colors.onPrimary}
        />
        <Text style={styles.buttonText}>{t("toggleView")}</Text>
      </TouchableOpacity>
    </>
  );

  return (
    <SectionHeader
      title={viewMode === "timeline" ? t("timelineView") : t("graphView")}
      rightActions={rightActions}
    />
  );
};

const styles = StyleSheet.create((theme) => ({
  controlButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.space.md,
    paddingVertical: theme.space.sm,
    borderRadius: theme.radius.md,
    gap: theme.space.sm,
  },
  iconButton: {
    paddingHorizontal: theme.space.xs,
    paddingVertical: theme.space.xxs,
  },
  buttonText: {
    ...theme.typography.caption,
    color: theme.colors.onPrimary,
    fontWeight: "600",
  },
}));

export default PatternGraphHeader;
