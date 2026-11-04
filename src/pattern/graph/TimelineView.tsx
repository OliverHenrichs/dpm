import React, { useCallback, useMemo, useState } from "react";
import { useWindowDimensions, View } from "react-native";
// Gesture Handler's scroll views, so the lane drag below arbitrates with the scrolling inside
// one gesture system rather than racing a native scroll view it cannot see.
import { ScrollView } from "react-native-gesture-handler";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import Svg from "react-native-svg";
import { IPattern } from "@/src/pattern/types/IPatternList";
import { PatternType } from "@/src/pattern/types/PatternType";
import {
  generateOrthogonalPath,
  generateSkipLevelPath,
  LayoutPosition,
} from "./utils/GraphUtils";
import { ArrowheadMarker } from "@/src/pattern/graph/render/GraphPrimitives";
import { rasterizeLargeGraph } from "./utils/RasterizeProps";
import GraphEmptyState from "@/src/pattern/graph/components/GraphEmptyState";
import {
  MIN_PATTERN_HEIGHT,
  MIN_PATTERNS_VISIBLE,
} from "@/src/pattern/graph/types/Constants";
import {
  calculateDynamicTimelineLayout,
  SkipLevelEdgeInfo,
  SwimlaneInfo,
} from "./utils/TimelineGraphUtils";
import {
  GraphEdge,
  GraphModel,
  GraphNode,
} from "@/src/pattern/graph/model/GraphModel";
import { moveLane } from "@/src/pattern/graph/utils/laneOrder";
import { useLaneDrag } from "@/src/pattern/graph/hooks/useLaneDrag";
import LaneHandles, {
  LANE_LABEL_X_WITH_HANDLE,
} from "@/src/pattern/graph/components/LaneHandles";
import { useLaneMotion } from "@/src/pattern/graph/hooks/useLaneMotion";
import {
  CrossEdge,
  CrossLaneEdge,
  LaneBandLayer,
  LaneContent,
  LaneFiguresLayer,
} from "@/src/pattern/graph/render/TimelineLanes";

/** Where a lane's name starts when it has no grip in front of it. */
const LANE_LABEL_X = 20;

interface TimelineViewProps {
  model: GraphModel;
  patternTypes: PatternType[];
  /** Distinguishes "nothing matched" from "this list is empty". */
  hasActiveFilter: boolean;
  onNodeTap: (pattern: IPattern) => void;
  /** The list's manual lane order (`IPatternList.laneOrder`); absent for the automatic one. */
  laneOrder?: string[];
  /**
   * Saves the lanes as the user dragged them: the shown lanes' type ids, top to bottom. Absent
   * on a read-only list, which then has no grips.
   */
  onReorderLanes?: (shownOrder: string[]) => void;
}

const TimelineView: React.FC<TimelineViewProps> = ({
  model,
  patternTypes,
  hasActiveFilter,
  onNodeTap,
  laneOrder,
  onReorderLanes,
}) => {
  const patterns = model.patterns;
  const { theme } = useUnistyles();
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();

  // The order just dropped, until the list saved with it comes back as `laneOrder`: without it
  // the lanes would jump back to the old order for the moment the write takes.
  const [dropped, setDropped] = useState<{
    base: string[] | undefined;
    order: string[];
  } | null>(null);
  const savedOrder =
    dropped && dropped.base === laneOrder ? dropped.order : laneOrder;

  // While a lane is dragged, the lanes reflow to where it would land: the drag's preview order
  // stands in for the saved one. Set once per lane passed, not per frame (`useLaneDrag`).
  const [preview, setPreview] = useState<string[] | null>(null);
  const shownOrder = preview ?? savedOrder;

  const { positions, svgWidth, svgHeight, swimlanes, skipLevelEdges } =
    useMemo(() => {
      // No cycle detection here: the model already has `cycles`, computed once
      // for both views rather than on every render of this one.
      const minBaseHeight = MIN_PATTERN_HEIGHT * MIN_PATTERNS_VISIBLE;
      const baseHeight = Math.max(screenHeight, minBaseHeight);

      const {
        positions,
        minHeight,
        actualWidth,
        swimlanes: dynamicSwimlanes,
        skipLevelEdgeInfos,
      } = calculateDynamicTimelineLayout(
        patterns,
        patternTypes,
        screenWidth,
        baseHeight,
        // The model's depth map, not one derived from `patterns`: under a
        // filter those differ, and re-deriving it would re-base every column
        // so patterns jumped sideways as the filter was toggled.
        model.depthMap,
        shownOrder,
      );

      return {
        positions,
        svgWidth: actualWidth,
        svgHeight: minHeight,
        swimlanes: dynamicSwimlanes,
        skipLevelEdges: skipLevelEdgeInfos,
      };
    }, [
      patterns,
      patternTypes,
      screenHeight,
      screenWidth,
      model.depthMap,
      shownOrder,
    ]);

  const canReorder = !!onReorderLanes && swimlanes.length > 1;
  const handleDrop = useCallback(
    (order: string[]) => {
      setDropped({ base: laneOrder, order });
      onReorderLanes?.(order);
    },
    [laneOrder, onReorderLanes],
  );
  const lanes = useMemo(
    () =>
      swimlanes.map((lane) => ({
        typeId: lane.typeId ?? "",
        y: lane.y,
        height: lane.height,
      })),
    [swimlanes],
  );
  const drag = useLaneDrag(lanes, handleDrop, canReorder);
  const laneMotion = useLaneMotion(swimlanes);
  const { laneContents, crossEdges } = useMemo(
    () =>
      splitIntoLanes(
        model.nodes,
        model.edges,
        positions,
        swimlanes,
        skipLevelEdges,
      ),
    [model.nodes, model.edges, positions, swimlanes, skipLevelEdges],
  );

  // The preview follows the drag's target, adjusted during render rather than in an effect
  // (the layout above needs it, and the drag needs the layout).
  const { dragging, target } = drag;
  const [previewFor, setPreviewFor] = useState<{
    dragging: typeof dragging;
    target: number | null;
  }>({ dragging: null, target: null });
  if (previewFor.dragging !== dragging || previewFor.target !== target) {
    setPreviewFor({ dragging, target });
    setPreview(
      dragging && target !== null
        ? moveLane(dragging.order, dragging.from, target)
        : null,
    );
  }

  const handleStep = (index: number, step: -1 | 1) =>
    handleDrop(
      moveLane(
        lanes.map((lane) => lane.typeId),
        index,
        index + step,
      ),
    );

  if (patterns.length === 0) {
    return <GraphEmptyState hasActiveFilter={hasActiveFilter} />;
  }

  const labelX = canReorder ? LANE_LABEL_X_WITH_HANDLE : LANE_LABEL_X;
  // The lane whose name is on the lifted label: while it is dragged, and while that label
  // settles into place after the drop.
  const liftedId = drag.dragging?.typeId ?? drag.settling?.typeId;

  // Bands, then the edges between lanes, then each lane's figures: the order one SVG used to
  // draw them in, split so that each lane can slide as a piece.
  return (
    <ScrollView style={styles.container} scrollEnabled={!drag.dragging}>
      <ScrollView
        horizontal
        contentContainerStyle={{ width: svgWidth }}
        scrollEnabled={!drag.dragging}
      >
        <View style={{ width: svgWidth, height: svgHeight }}>
          {laneContents.map(({ lane, typeId }) => (
            <LaneBandLayer
              key={typeId}
              lane={lane}
              typeId={typeId}
              width={svgWidth}
              lanes={laneMotion}
              labelX={labelX}
              highlighted={typeId === drag.dragging?.typeId}
              nameHidden={typeId === liftedId}
              uppercase={theme.list.sectionUppercase}
            />
          ))}
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <Svg width={svgWidth} height={svgHeight}>
              <ArrowheadMarker />
              {crossEdges.map((edge) => (
                <CrossLaneEdge key={edge.key} edge={edge} lanes={laneMotion} />
              ))}
            </Svg>
          </View>
          {laneContents.map((content) => (
            <LaneFiguresLayer
              key={content.typeId}
              content={content}
              width={svgWidth}
              lanes={laneMotion}
              onNodeTap={onNodeTap}
              rasterize={rasterizeLargeGraph(patterns.length)}
            />
          ))}
          {canReorder && (
            <LaneHandles
              lanes={swimlanes}
              motion={laneMotion}
              drag={drag}
              height={svgHeight}
              uppercase={theme.list.sectionUppercase}
              onStep={handleStep}
            />
          )}
        </View>
      </ScrollView>
    </ScrollView>
  );
};

/**
 * Splits the laid-out timeline into lanes, each with its figures and the edges inside it
 * relative to its own top, and the edges between lanes. Reordering lanes moves each one as a
 * whole (`laneOrder.test.ts` holds that), so a lane drawn this way only has to be slid.
 *
 * Skip-level edges route through the cleared space below shifted nodes; they never leave their
 * lane, since collision avoidance only shifts within one.
 */
function splitIntoLanes(
  nodes: GraphNode[],
  edges: GraphEdge[],
  positions: Map<number, LayoutPosition>,
  swimlanes: SwimlaneInfo[],
  skipLevelEdges: SkipLevelEdgeInfo[],
): { laneContents: LaneContent[]; crossEdges: CrossEdge[] } {
  const laneOf = new Map<number, string>();
  nodes.forEach((node) => laneOf.set(node.pattern.id, node.pattern.typeId));

  const byType = new Map<string, LaneContent>();
  const laneContents = swimlanes.map((lane) => {
    const typeId = lane.typeId ?? "";
    const content: LaneContent = {
      lane,
      typeId,
      nodes: [],
      positions: new Map(),
      edges: [],
    };
    byType.set(typeId, content);
    return content;
  });
  const relative = (pos: LayoutPosition, content: LaneContent) => ({
    x: pos.x,
    y: pos.y - content.lane.y,
  });

  nodes.forEach((node) => {
    const pos = positions.get(node.pattern.id);
    const content = byType.get(node.pattern.typeId);
    if (!pos || !content) return;
    content.nodes.push(node);
    content.positions.set(node.pattern.id, relative(pos, content));
  });

  const skipLevelEdgeMap = new Map<string, SkipLevelEdgeInfo>();
  skipLevelEdges.forEach((edge) => {
    if (edge.intermediateNodeIds.length > 0) {
      skipLevelEdgeMap.set(`${edge.fromId}-${edge.toId}`, edge);
    }
  });

  const crossEdges: CrossEdge[] = [];
  edges.forEach((edge, index) => {
    const fromPos = positions.get(edge.from);
    const toPos = positions.get(edge.to);
    const fromLane = byType.get(laneOf.get(edge.from) ?? "");
    const toLane = byType.get(laneOf.get(edge.to) ?? "");
    if (!fromPos || !toPos || !fromLane || !toLane) return;
    const key = `edge-${edge.from}-${edge.to}-${index}`;
    const elided = edge.kind === "elided";

    if (fromLane !== toLane) {
      crossEdges.push({
        key,
        from: relative(fromPos, fromLane),
        to: relative(toPos, toLane),
        fromLane: fromLane.typeId,
        toLane: toLane.typeId,
        fromTop: fromLane.lane.y,
        toTop: toLane.lane.y,
        elided,
      });
      return;
    }

    const from = relative(fromPos, fromLane);
    const to = relative(toPos, fromLane);
    const skip = skipLevelEdgeMap.get(`${edge.from}-${edge.to}`);
    const d = skip
      ? generateSkipLevelPath(
          from,
          to,
          skip.originalIntermediateY - fromLane.lane.y,
          skip.firstIntermediateX,
          skip.lastIntermediateX,
        )
      : // Left to right, for the timeline's flow.
        generateOrthogonalPath(from, to, true);
    fromLane.edges.push({ key, d, elided });
  });

  return { laneContents, crossEdges };
}

const styles = StyleSheet.create((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
}));

export default TimelineView;
