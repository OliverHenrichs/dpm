import React from "react";
import { View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { IPattern } from "@/src/pattern/types/IPatternList";
import { PatternType } from "@/src/pattern/types/PatternType";
import TimelineView from "./TimelineView";
import NetworkGraphView from "./NetworkGraphView";
import Legend from "./Legend";
import CycleWarning from "./CycleWarning";
import { ViewMode } from "@/src/pattern/graph/types/ViewMode";
import { GraphModel } from "@/src/pattern/graph/model/GraphModel";
import { LayoutPosition } from "@/src/pattern/graph/utils/GraphUtils";

interface GraphViewContainerProps {
  viewMode: ViewMode;
  model: GraphModel;
  patternTypes: PatternType[];
  /**
   * Remounts the view when it changes, which re-fits the viewport. Includes
   * the drawn node count, so a filter that narrows the graph does not leave
   * the user at the zoom the whole graph needed.
   */
  resetKey: string;
  /** Distinguishes "nothing matched" from "this list is empty". */
  hasActiveFilter: boolean;
  /** The network view's positions: a manual layout where one exists. */
  positions: Map<number, LayoutPosition>;
  onMoveNode: (id: number, position: LayoutPosition) => void;
  onNodeTap: (pattern: IPattern) => void;
}

const GraphViewContainer: React.FC<GraphViewContainerProps> = ({
  viewMode,
  model,
  patternTypes,
  resetKey,
  hasActiveFilter,
  positions,
  onMoveNode,
  onNodeTap,
}) => {
  return (
    <>
      <CycleWarning cycles={model.cycles} />

      <View style={styles.viewContainer}>
        {viewMode === "timeline" ? (
          <TimelineView
            key={`timeline-${resetKey}`}
            model={model}
            patternTypes={patternTypes}
            hasActiveFilter={hasActiveFilter}
            onNodeTap={onNodeTap}
          />
        ) : (
          <NetworkGraphView
            key={`graph-${resetKey}`}
            model={model}
            hasActiveFilter={hasActiveFilter}
            positions={positions}
            onMoveNode={onMoveNode}
            onNodeTap={onNodeTap}
          />
        )}
      </View>

      <Legend
        patternTypes={patternTypes}
        showLevels={model.patterns.some((p) => !!p.level)}
      />
    </>
  );
};

const styles = StyleSheet.create((theme) => ({
  viewContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
}));

export default GraphViewContainer;
