import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { IPattern } from "@/src/pattern/types/IPatternList";
import AppHeader from "@/src/common/components/AppHeader";
import PageContainer from "@/src/common/components/PageContainer";
import { useThemeContext } from "@/src/common/components/ThemeContext";
import { useTranslation } from "react-i18next";
import { getPalette, PaletteColor } from "@/src/common/utils/ColorPalette";
import { getCommonListContainer } from "@/src/common/utils/CommonStyles";
import PatternGraphHeader from "./PatternGraphHeader";
import GraphViewContainer from "./GraphViewContainer";
import PatternDetailsModal from "./PatternDetailsModal";
import { useActivePatternList } from "@/src/pattern/data/components/ActivePatternListContext";
import { ViewMode } from "@/src/pattern/graph/types/ViewMode";
import { useGraphFilter } from "@/src/pattern/graph/hooks/useGraphFilter";
import PatternFilterBottomSheet from "@/src/pattern/filter/components/PatternFilterBottomSheet";
import ChainModeFilter from "@/src/pattern/graph/components/ChainModeFilter";
import GraphFilterSummary from "@/src/pattern/graph/components/GraphFilterSummary";
import AppDialog from "@/src/common/components/AppDialog";
import { useGraphPositions } from "@/src/pattern/graph/hooks/useGraphPositions";
import { useGraphLayout } from "@/src/pattern/graph/hooks/useGraphLayout";

const PatternGraphScreen: React.FC = () => {
  const { t } = useTranslation();
  const { colorScheme } = useThemeContext();
  const palette = getPalette(colorScheme);
  const styles = getStyles(palette);
  const { activeList, patterns } = useActivePatternList();

  const [viewMode, setViewMode] = useState<ViewMode>("timeline");
  const [selectedPattern, setSelectedPattern] = useState<IPattern | undefined>(
    undefined,
  );
  const [resetKey, setResetKey] = useState(0);
  const [filterVisible, setFilterVisible] = useState(false);
  const [resetLayoutVisible, setResetLayoutVisible] = useState(false);

  const handleToggleView = () => {
    setViewMode((prev) => (prev === "timeline" ? "graph" : "timeline"));
    setResetKey((prev) => prev + 1);
  };

  const handleNodeTap = (pattern: IPattern) => {
    setSelectedPattern(pattern);
  };

  const handleCloseModal = () => {
    setSelectedPattern(undefined);
  };

  // Get pattern types / modifiers from active list or empty array
  const patternTypes = activeList?.patternTypes ?? [];
  const modifiers = activeList?.modifiers ?? [];

  // One model, shared by both views: switching between them costs nothing and
  // they cannot disagree about depth, edges or cycles. Narrowed to the filter's
  // matches and their chains when a filter is active.
  const {
    model,
    filter,
    setFilter,
    chainMode,
    setChainMode,
    hasActiveFilter,
    matchedCount,
    shownCount,
    totalCount,
    clearFilter,
  } = useGraphFilter(patterns, patternTypes, activeList?.id);

  // Re-fit the viewport when the drawn set changes, or a narrowed graph opens
  // at the zoom the whole graph needed and reads as an empty canvas.
  const contentKey = `${resetKey}-${model.nodes.length}-${chainMode}`;

  // The automatic layout of whatever is currently drawn, and the manual one
  // laid over it. Reconciliation is against the *unfiltered* patterns: a
  // filter hides patterns rather than deleting them, and pruning against the
  // filtered set would discard the user's arrangement the moment they search.
  const { positions: autoPositions } = useGraphLayout(model);
  const { positions, hasManualLayout, moveNode, resetLayout } =
    useGraphPositions(activeList?.id, patterns, autoPositions);

  const handleResetLayout = async () => {
    setResetLayoutVisible(false);
    await resetLayout();
    setResetKey((prev) => prev + 1);
  };

  return (
    <View style={{ flex: 1 }}>
      <PageContainer
        style={{ backgroundColor: palette[PaletteColor.Background] }}
      >
        <AppHeader />

        <View style={styles.contentContainer}>
          <PatternGraphHeader
            viewMode={viewMode}
            onToggleView={handleToggleView}
            hasActiveFilter={hasActiveFilter}
            onFilter={() => setFilterVisible(true)}
            canResetLayout={hasManualLayout}
            onResetLayout={() => setResetLayoutVisible(true)}
          />

          <GraphFilterSummary
            visible={hasActiveFilter}
            matched={matchedCount}
            shown={shownCount}
            total={totalCount}
            onClear={clearFilter}
            palette={palette}
          />

          <GraphViewContainer
            viewMode={viewMode}
            model={model}
            patternTypes={patternTypes}
            palette={palette}
            resetKey={contentKey}
            hasActiveFilter={hasActiveFilter}
            positions={positions}
            onMoveNode={moveNode}
            onNodeTap={handleNodeTap}
          />
        </View>

        <PatternFilterBottomSheet
          visible={filterVisible}
          onClose={() => setFilterVisible(false)}
          onApplyFilter={setFilter}
          currentFilter={filter}
          allPatterns={patterns}
          patternTypes={patternTypes}
          headerSection={
            <ChainModeFilter
              chainMode={chainMode}
              onChange={setChainMode}
              palette={palette}
            />
          }
        />

        <AppDialog
          visible={resetLayoutVisible}
          title={t("resetLayout")}
          message={t("resetLayoutConfirm")}
          closeLabel={t("cancel")}
          confirmLabel={t("reset")}
          onConfirm={handleResetLayout}
          onClose={() => setResetLayoutVisible(false)}
        />

        <PatternDetailsModal
          visible={selectedPattern !== undefined}
          pattern={selectedPattern}
          allPatterns={patterns}
          patternTypes={patternTypes}
          modifiers={modifiers}
          onClose={handleCloseModal}
        />
      </PageContainer>
    </View>
  );
};

const getStyles = (palette: Record<PaletteColor, string>) =>
  StyleSheet.create({
    contentContainer: {
      ...getCommonListContainer(palette),
      flex: 1,
    },
  });

export default PatternGraphScreen;
