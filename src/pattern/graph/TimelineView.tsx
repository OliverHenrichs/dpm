import React, { useCallback, useMemo, useState } from "react";
import { useWindowDimensions, View } from "react-native";
// Gesture Handler's scroll views, so the lane drag below arbitrates with the scrolling inside
// one gesture system rather than racing a native scroll view it cannot see.
import { ScrollView } from "react-native-gesture-handler";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import Svg, { Path, Rect, Text as SvgText } from "react-native-svg";
import { IPattern } from "@/src/pattern/types/IPatternList";
import { PatternType } from "@/src/pattern/types/PatternType";
import type { AppTheme } from "@/src/common/theme/tokens";
import {
  generateOrthogonalPath,
  generateSkipLevelPath,
  LayoutPosition,
} from "./utils/GraphUtils";
import {
  ArrowheadMarker,
  drawNodes,
} from "@/src/pattern/graph/render/GraphPrimitives";
import { rasterizeLargeGraph } from "./utils/RasterizeProps";
import GraphEmptyState from "@/src/pattern/graph/components/GraphEmptyState";
import { edgeStroke } from "@/src/pattern/graph/render/edgeStyle";
import {
  MIN_PATTERN_HEIGHT,
  MIN_PATTERNS_VISIBLE,
} from "@/src/pattern/graph/types/Constants";
import {
  calculateDynamicTimelineLayout,
  SkipLevelEdgeInfo,
  SwimlaneInfo,
} from "./utils/TimelineGraphUtils";
import { GraphEdge, GraphModel } from "@/src/pattern/graph/model/GraphModel";
import { moveLane } from "@/src/pattern/graph/utils/laneOrder";
import { useLaneDrag } from "@/src/pattern/graph/hooks/useLaneDrag";
import LaneHandles, {
  LANE_LABEL_X_WITH_HANDLE,
} from "@/src/pattern/graph/components/LaneHandles";

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

  return (
    <ScrollView style={styles.container} scrollEnabled={!drag.dragging}>
      <ScrollView
        horizontal
        contentContainerStyle={{ width: svgWidth }}
        scrollEnabled={!drag.dragging}
      >
        <View style={{ width: svgWidth, height: svgHeight }}>
          <Svg
            width={svgWidth}
            height={svgHeight}
            {...rasterizeLargeGraph(patterns.length)}
          >
            <ArrowheadMarker />
            {drawSwimlanes(swimlanes, svgWidth, theme, {
              labelX: canReorder ? LANE_LABEL_X_WITH_HANDLE : LANE_LABEL_X,
              draggingId: drag.dragging?.typeId,
            })}
            {drawTimelineEdges(model.edges, positions, skipLevelEdges, theme)}
            {drawNodes(model.nodes, positions, onNodeTap)}
          </Svg>
          {canReorder && (
            <LaneHandles
              lanes={swimlanes}
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
 * Draw edges with optimized routing for skip-level edges.
 * Skip-level edges route through the cleared space below shifted nodes.
 */
function drawTimelineEdges(
  edges: GraphEdge[],
  positions: Map<number, LayoutPosition>,
  skipLevelEdges: SkipLevelEdgeInfo[],
  theme: AppTheme,
) {
  // Create a map of skip-level edges for quick lookup
  const skipLevelEdgeMap = new Map<string, SkipLevelEdgeInfo>();
  skipLevelEdges.forEach((edge) => {
    if (edge.intermediateNodeIds.length > 0) {
      const key = `${edge.fromId}-${edge.toId}`;
      skipLevelEdgeMap.set(key, edge);
    }
  });

  return (
    <>
      {edges.map((edge, index) => {
        const fromPos = positions.get(edge.from);
        const toPos = positions.get(edge.to);
        if (!fromPos || !toPos) return null;

        const edgeKey = `${edge.from}-${edge.to}`;
        const skipLevelInfo = skipLevelEdgeMap.get(edgeKey);

        let pathData: string;
        if (skipLevelInfo && skipLevelInfo.intermediateNodeIds.length > 0) {
          // This is a skip-level edge with shifted nodes - use optimized routing
          // Use the pre-calculated original Y position from the edge info
          // Pass forceDirection=true for timeline left-to-right flow
          pathData = generateSkipLevelPath(
            fromPos,
            toPos,
            skipLevelInfo.originalIntermediateY,
            skipLevelInfo.firstIntermediateX,
            skipLevelInfo.lastIntermediateX,
          );
        } else {
          // Regular edge - use standard orthogonal routing
          // Pass forceDirection=true for timeline left-to-right flow
          pathData = generateOrthogonalPath(fromPos, toPos, true);
        }

        const elided = edge.kind === "elided";
        return (
          <Path
            key={`edge-${index}`}
            d={pathData}
            {...edgeStroke(theme, elided)}
            fill="none"
            markerEnd="url(#arrowhead-graph)"
          />
        );
      })}
    </>
  );
}

/**
 * Lanes, labelled like the pattern list's section headers in the app style:
 * After Hours' italic serif, Clipboard's mono capitals. A lane being dragged is
 * tinted more strongly where it would land; its name rides on the lifted label.
 */
function drawSwimlanes(
  swimlanes: SwimlaneInfo[],
  svgWidth: number,
  theme: AppTheme,
  { labelX, draggingId }: { labelX: number; draggingId?: string },
) {
  const { section } = theme.typography;
  return (
    <>
      {swimlanes.map((swimlane) => (
        <React.Fragment key={swimlane.typeId || swimlane.label}>
          <Rect
            x={0}
            y={swimlane.y}
            width={svgWidth}
            height={swimlane.height}
            fill={swimlane.color}
            fillOpacity={swimlane.typeId === draggingId ? 0.25 : 0.1}
          />
          <SvgText
            x={labelX}
            y={swimlane.y + 25}
            fontFamily={section.fontFamily}
            fontSize={section.fontSize}
            fontWeight={section.fontWeight}
            fontStyle={section.fontStyle}
            letterSpacing={section.letterSpacing}
            fill={swimlane.color}
            fillOpacity={swimlane.typeId === draggingId ? 0 : 0.5}
          >
            {laneLabel(swimlane, theme.list.sectionUppercase)}
          </SvgText>
        </React.Fragment>
      ))}
    </>
  );
}

function laneLabel(swimlane: SwimlaneInfo, uppercase: boolean): string {
  const label = swimlane.label || swimlane.typeId || "";
  return uppercase ? label.toUpperCase() : label;
}

const styles = StyleSheet.create((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
}));

export default TimelineView;
