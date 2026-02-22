import React, { useMemo } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Svg, { Path, Rect, Text as SvgText } from "react-native-svg";
import { Pattern } from "@/components/pattern/types/PatternList";
import { PatternType } from "@/components/pattern/types/PatternType";
import { PaletteColor } from "@/components/common/ColorPalette";
import {
  generateEdges,
  generateOrthogonalPath,
  generateSkipLevelPath,
  LayoutPosition,
} from "./utils/GraphUtils";
import { ArrowheadMarker, drawNodes } from "./GraphSvg";
import { useTranslation } from "react-i18next";
import {
  MIN_PATTERN_HEIGHT,
  MIN_PATTERNS_VISIBLE,
} from "@/components/pattern/graph/types/Constants";
import {
  calculateDynamicTimelineLayout,
  SkipLevelEdgeInfo,
  SwimlaneInfo,
} from "./utils/TimelineGraphUtils";
import { detectCircularDependencies } from "@/components/pattern/graph/utils/GenericGraphUtils";

interface TimelineViewProps {
  patterns: Pattern[];
  patternTypes: PatternType[];
  palette: Record<PaletteColor, string>;
  onNodeTap: (pattern: Pattern) => void;
}

const TimelineView: React.FC<TimelineViewProps> = ({
  patterns,
  patternTypes,
  palette,
  onNodeTap,
}) => {
  const { t } = useTranslation();
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();
  const styles = getStyles(palette);

  const {
    positions,
    svgWidth,
    svgHeight,
    swimlanes,
    skipLevelEdges,
    typeColorMap,
  } = useMemo(() => {
    detectCircularDependencies(patterns);

    const minBaseHeight = MIN_PATTERN_HEIGHT * MIN_PATTERNS_VISIBLE;
    const baseHeight = Math.max(screenHeight, minBaseHeight);

    const {
      positions,
      minHeight,
      actualWidth,
      swimlanes: dynamicSwimlanes,
      skipLevelEdgeInfos,
      typeColorMap,
    } = calculateDynamicTimelineLayout(
      patterns as Pattern[],
      patternTypes,
      screenWidth,
      baseHeight,
    );

    return {
      positions,
      svgWidth: actualWidth,
      svgHeight: minHeight,
      swimlanes: dynamicSwimlanes,
      skipLevelEdges: skipLevelEdgeInfos,
      typeColorMap,
    };
  }, [patterns, patternTypes, screenHeight, screenWidth]);

  if (patterns.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>{t("noPatternsToVisualize")}</Text>
      </View>
    );
  }

  const edges = generateEdges(patterns);

  return (
    <ScrollView style={styles.container}>
      <ScrollView horizontal contentContainerStyle={{ width: svgWidth }}>
        <Svg
          width={svgWidth}
          height={svgHeight}
          shouldRasterizeIOS={patterns.length > 100}
        >
          <ArrowheadMarker palette={palette} />
          {drawSwimlanes(swimlanes, svgWidth)}
          {drawTimelineEdges(edges, positions, skipLevelEdges, palette)}
          {drawNodes(patterns, positions, palette, onNodeTap, typeColorMap)}
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
  edges: { from: number; to: number }[],
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

        return (
          <Path
            key={`edge-${index}`}
            d={pathData}
            stroke={palette[PaletteColor.Primary]}
            strokeWidth={2}
            fill="none"
            markerEnd="url(#arrowhead-graph)"
            opacity={0.6}
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
