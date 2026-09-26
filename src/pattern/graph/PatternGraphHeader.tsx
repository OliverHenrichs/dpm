import React from "react";
import { Button, IconButton } from "@/src/common/ui";
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

  const rightActions = (
    <>
      {/* Only shown once the user has actually moved something: an always-on
          reset for a layout nobody arranged is a button that does nothing. */}
      {canResetLayout && viewMode === "graph" && (
        <IconButton
          icon="backup-restore"
          onPress={onResetLayout}
          accessibilityLabel={t("resetLayout")}
        />
      )}
      {/* Same icon/colour convention as PatternListHeader, so an active
          filter reads the same on both screens. */}
      <IconButton
        icon={hasActiveFilter ? "filter" : "filter-outline"}
        color={hasActiveFilter ? "success" : "primary"}
        selected={hasActiveFilter}
        onPress={onFilter}
        accessibilityLabel={t("filterPatterns")}
      />
      <Button
        title={t("toggleView")}
        icon={viewMode === "timeline" ? "graph" : "timeline"}
        size="sm"
        onPress={onToggleView}
      />
    </>
  );

  return (
    <SectionHeader
      title={viewMode === "timeline" ? t("timelineView") : t("graphView")}
      rightActions={rightActions}
    />
  );
};

export default PatternGraphHeader;
