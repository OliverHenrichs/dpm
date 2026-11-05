import React, { useMemo, useState } from "react";
import { View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { IPattern } from "@/src/pattern/types/IPatternList";
import AppHeader from "@/src/common/components/AppHeader";
import PageContainer from "@/src/common/components/PageContainer";
import { useTranslation } from "react-i18next";
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
import GraphDragHint from "@/src/pattern/graph/components/GraphDragHint";
import AppDialog from "@/src/common/components/AppDialog";
import { useGraphPositions } from "@/src/pattern/graph/hooks/useGraphPositions";
import { useGraphLayout } from "@/src/pattern/graph/hooks/useGraphLayout";
import { usePatternCrud } from "@/src/pattern/list/hooks/usePatternCrud";
import EditPatternModal, {
  usePatternEditing,
} from "@/src/pattern/list/EditPatternModal";
import SuggestPatternModal from "@/src/pattern/suggestions/SuggestPatternModal";
import { canSuggestEditsTo } from "@/src/pattern/suggestions/suggestions";
import { firebaseAvailable } from "@/src/firebase/firebaseConfig";
import { reorderLanes } from "@/src/pattern/graph/utils/laneOrder";
import { resolveLevelIds } from "@/src/pattern/types/PatternLevel";
import SequenceMapFilter from "@/src/pattern/graph/components/SequenceMapFilter";
import SequenceMapSummary from "@/src/pattern/graph/components/SequenceMapSummary";
import { sequenceOverlay } from "@/src/pattern/graph/model/sequenceOverlay";
import SequenceModal, {
  OpenSequence,
} from "@/src/pattern/sequences/SequenceModal";

const PatternGraphScreen: React.FC = () => {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const { activeList, patterns } = useActivePatternList();
  // Recolouring a type from the legend and reordering the lanes: owners only, through the same
  // mutation path as edits.
  const { isReadonly, setPatternTypeColor, setLaneOrder, sequences } =
    usePatternCrud();

  const [viewMode, setViewMode] = useState<ViewMode>("timeline");
  // By id, so the details show the figure as it is now: after an edit from here, the change
  // is in place when the details come back.
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selectedPattern =
    selectedId === null
      ? undefined
      : patterns.find((pattern) => pattern.id === selectedId);
  // Editing the figure from its details, in the List tab's form (`EditPatternModal`). The
  // details step aside while the form is open and come back when it closes.
  const { editing, startEditing, stopEditing } = usePatternEditing();
  // A subscriber's counterpart: suggesting a change to the figure, when the list owner takes them.
  const [suggestingEdit, setSuggestingEdit] = useState<IPattern | null>(null);
  const mayBeSuggestedEditsTo =
    firebaseAvailable && canSuggestEditsTo(activeList);
  const [resetLaneOrderVisible, setResetLaneOrderVisible] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [filterVisible, setFilterVisible] = useState(false);
  const [resetLayoutVisible, setResetLayoutVisible] = useState(false);
  // "Show sequence" (#136, phase 3): one of the list's sequences laid over the graph. Not
  // persisted, like the filter, and dropped when the active list changes.
  const [shownSequenceId, setShownSequenceId] = useState<string | null>(null);
  // A sequence opened from a figure's "In: …" or from the summary line. The details step aside
  // meanwhile, as for the edit form, and come back when it closes.
  const [openSequence, setOpenSequence] = useState<OpenSequence | null>(null);
  const [sequenceListId, setSequenceListId] = useState(activeList?.id);
  if (sequenceListId !== activeList?.id) {
    setSequenceListId(activeList?.id);
    setShownSequenceId(null);
    setOpenSequence(null);
  }

  const handleToggleView = () => {
    setViewMode((prev) => (prev === "timeline" ? "graph" : "timeline"));
    setResetKey((prev) => prev + 1);
  };

  const handleNodeTap = (pattern: IPattern) => {
    setSelectedId(pattern.id);
  };

  const handleCloseModal = () => {
    setSelectedId(null);
  };

  // Get pattern types / modifiers from active list or empty array
  const patternTypes = activeList?.patternTypes ?? [];
  const modifiers = activeList?.modifiers ?? [];
  // The list's levels in their order, for the nodes' shading. Memoised: the model is rebuilt
  // whenever its identity changes.
  const listLevels = activeList?.levels;
  const levelIds = useMemo(() => resolveLevelIds(listLevels), [listLevels]);

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
  } = useGraphFilter(patterns, patternTypes, activeList?.id, levelIds);

  // A deleted sequence simply stops being shown.
  const shownSequence = sequences.find((s) => s.id === shownSequenceId);
  const overlay = useMemo(
    () =>
      shownSequence
        ? sequenceOverlay(
            shownSequence,
            new Set(model.nodes.map((node) => node.pattern.id)),
          )
        : undefined,
    [shownSequence, model.nodes],
  );
  const sequenceFigures = useMemo(() => {
    if (!shownSequence) return 0;
    const ids = new Set(patterns.map((p) => p.id));
    return new Set(
      shownSequence.steps.flatMap((step) =>
        step.kind === "figure" && ids.has(step.patternId)
          ? [step.patternId]
          : [],
      ),
    ).size;
  }, [shownSequence, patterns]);

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

  // The timeline's lanes as the user dragged them. Saved over every type of the list, so lanes a
  // filter hides keep their places (`reorderLanes`).
  const laneOrder = activeList?.laneOrder;
  const handleReorderLanes = (shownOrder: string[]) => {
    void setLaneOrder(
      reorderLanes(patternTypes, patterns, laneOrder, shownOrder),
    );
  };
  const handleResetLaneOrder = async () => {
    setResetLaneOrderVisible(false);
    await setLaneOrder(undefined);
  };

  const handleResetLayout = async () => {
    setResetLayoutVisible(false);
    await resetLayout();
    setResetKey((prev) => prev + 1);
  };

  return (
    <View style={{ flex: 1 }}>
      <PageContainer style={{ backgroundColor: theme.colors.background }}>
        <AppHeader />

        <View style={styles.contentContainer}>
          <PatternGraphHeader
            viewMode={viewMode}
            onToggleView={handleToggleView}
            hasActiveFilter={hasActiveFilter || !!shownSequence}
            onFilter={() => setFilterVisible(true)}
            canResetLayout={hasManualLayout}
            onResetLayout={() => setResetLayoutVisible(true)}
            canResetLaneOrder={!isReadonly && !!laneOrder?.length}
            onResetLaneOrder={() => setResetLaneOrderVisible(true)}
          />

          <GraphDragHint
            visible={viewMode === "graph" && model.nodes.length > 0}
          />

          <GraphFilterSummary
            visible={hasActiveFilter}
            matched={matchedCount}
            shown={shownCount}
            total={totalCount}
            onClear={clearFilter}
          />

          <SequenceMapSummary
            name={shownSequence?.name}
            shown={overlay?.numbers.size ?? 0}
            figures={sequenceFigures}
            onOpen={() =>
              shownSequence &&
              setOpenSequence({ id: shownSequence.id, editing: false })
            }
            onClear={() => setShownSequenceId(null)}
          />

          <GraphViewContainer
            viewMode={viewMode}
            model={model}
            patternTypes={patternTypes}
            resetKey={contentKey}
            hasActiveFilter={hasActiveFilter}
            positions={positions}
            onMoveNode={moveNode}
            onNodeTap={handleNodeTap}
            onChangeTypeColor={
              activeList && !isReadonly ? setPatternTypeColor : undefined
            }
            laneOrder={laneOrder}
            onReorderLanes={
              activeList && !isReadonly ? handleReorderLanes : undefined
            }
            sequence={overlay}
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
            <>
              <SequenceMapFilter
                sequences={sequences}
                selectedId={shownSequence?.id ?? null}
                onChange={setShownSequenceId}
              />
              <ChainModeFilter chainMode={chainMode} onChange={setChainMode} />
            </>
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

        <AppDialog
          visible={resetLaneOrderVisible}
          title={t("resetLaneOrder")}
          message={t("resetLaneOrderConfirm")}
          closeLabel={t("cancel")}
          confirmLabel={t("reset")}
          onConfirm={handleResetLaneOrder}
          onClose={() => setResetLaneOrderVisible(false)}
        />

        <PatternDetailsModal
          visible={
            selectedPattern !== undefined &&
            editing === null &&
            suggestingEdit === null &&
            openSequence === null
          }
          pattern={selectedPattern}
          allPatterns={patterns}
          patternTypes={patternTypes}
          modifiers={modifiers}
          onClose={handleCloseModal}
          onEdit={
            activeList && !isReadonly && selectedPattern
              ? () => startEditing(selectedPattern)
              : undefined
          }
          onSuggestEdit={
            mayBeSuggestedEditsTo && selectedPattern
              ? () => setSuggestingEdit(selectedPattern)
              : undefined
          }
          sequences={sequences}
          onOpenSequence={(id) => setOpenSequence({ id, editing: false })}
        />

        <SequenceModal
          open={openSequence}
          onClose={() => setOpenSequence(null)}
        />

        <EditPatternModal pattern={editing} onClose={stopEditing} />

        {mayBeSuggestedEditsTo && activeList && (
          <SuggestPatternModal
            visible={suggestingEdit !== null}
            list={activeList}
            patterns={patterns}
            patternTypes={patternTypes}
            modifiers={modifiers}
            editing={suggestingEdit ?? undefined}
            onClose={() => setSuggestingEdit(null)}
          />
        )}
      </PageContainer>
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
  contentContainer: {
    ...getCommonListContainer(theme),
    flex: 1,
  },
}));

export default PatternGraphScreen;
