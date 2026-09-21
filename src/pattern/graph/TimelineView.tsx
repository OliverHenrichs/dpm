import React, { useMemo } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Svg, { Path, Rect, Text as SvgText } from "react-native-svg";
import { IPattern } from "@/src/pattern/types/IPatternList";
import { PatternType } from "@/src/pattern/types/PatternType";
import { PaletteColor } from "@/src/common/utils/ColorPalette";
import {
  generateOrthogonalPath,
  generateSkipLevelPath,
  LayoutPosition,
} from "./utils/GraphUtils";
import {
  ArrowheadMarker,
  drawNodes,
  ELIDED_DASH,
} from "@/src/pattern/graph/render/GraphPrimitives";
import { rasterizeLargeGraph } from "./utils/RasterizeProps";
import { useTranslation } from "react-i18next";
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

interface TimelineViewProps {
  model: GraphModel;
  patternTypes: PatternType[];
  palette: Record<PaletteColor, string>;
  /** Distinguishes "nothing matched" from "this list is empty". */
  hasActiveFilter: boolean;
  onNodeTap: (pattern: IPattern) => void;
}

const TimelineView: React.FC<TimelineViewProps> = ({
  model,
  patternTypes,
  palette,
  hasActiveFilter,
  onNodeTap,
}) => {
  const patterns = model.patterns;
  const { t } = useTranslation();
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();
  const styles = getStyles(palette);

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
      );

      return {
        positions,
        svgWidth: actualWidth,
        svgHeight: minHeight,
        swimlanes: dynamicSwimlanes,
        skipLevelEdges: skipLevelEdgeInfos,
      };
    }, [patterns, patternTypes, screenHeight, screenWidth, model.depthMap]);

  if (patterns.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>
          {t(
            hasActiveFilter ? "noPatternsMatchFilter" : "noPatternsToVisualize",
          )}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <ScrollView horizontal contentContainerStyle={{ width: svgWidth }}>
        <Svg
          width={svgWidth}
          height={svgHeight}
          {...rasterizeLargeGraph(patterns.length)}
        >
          <ArrowheadMarker palette={palette} />
          {drawSwimlanes(swimlanes, svgWidth)}
          {drawTimelineEdges(model.edges, positions, skipLevelEdges, palette)}
          {drawNodes(model.nodes, positions, palette, onNodeTap)}
        </Svg>
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
  palette: Record<PaletteColor, string>,
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
            stroke={palette[PaletteColor.Primary]}
            strokeWidth={2}
            strokeDasharray={elided ? ELIDED_DASH : undefined}
            fill="none"
            markerEnd="url(#arrowhead-graph)"
            opacity={elided ? 0.4 : 0.6}
          />
        );
      })}
    </>
  );
}

function drawSwimlanes(swimlanes: SwimlaneInfo[], svgWidth: number) {
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
            fillOpacity={0.1}
          />
          <SvgText
            x={20}
            y={swimlane.y + 25}
            fontSize={16}
            fontWeight="bold"
            fill={swimlane.color}
            fillOpacity={0.5}
          >
            {(swimlane.label || swimlane.typeId || "").toUpperCase()}
          </SvgText>
        </React.Fragment>
      ))}
    </>
  );
}

const getStyles = (palette: Record<PaletteColor, string>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: palette[PaletteColor.Background],
    },
    emptyContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: palette[PaletteColor.Background],
      padding: 32,
    },
    emptyText: {
      fontSize: 16,
      color: palette[PaletteColor.SecondaryText],
      textAlign: "center",
    },
  });

export default TimelineView;
