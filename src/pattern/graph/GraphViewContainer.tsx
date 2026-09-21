import React from "react";
import { StyleSheet, View } from "react-native";
import { IPattern } from "@/src/pattern/types/IPatternList";
import { PatternType } from "@/src/pattern/types/PatternType";
import { PaletteColor } from "@/src/common/utils/ColorPalette";
import TimelineView from "./TimelineView";
import NetworkGraphView from "./NetworkGraphView";
import Legend from "./Legend";
import CycleWarning from "./CycleWarning";
import { ViewMode } from "@/src/pattern/graph/types/ViewMode";
import { GraphModel } from "@/src/pattern/graph/model/GraphModel";

interface GraphViewContainerProps {
  viewMode: ViewMode;
  model: GraphModel;
  patternTypes: PatternType[];
  palette: Record<PaletteColor, string>;
  /**
   * Remounts the view when it changes, which re-fits the viewport. Includes
   * the drawn node count, so a filter that narrows the graph does not leave
   * the user at the zoom the whole graph needed.
   */
  resetKey: string;
  /** Distinguishes "nothing matched" from "this list is empty". */
  hasActiveFilter: boolean;
  onNodeTap: (pattern: IPattern) => void;
}

const GraphViewContainer: React.FC<GraphViewContainerProps> = ({
  viewMode,
  model,
  patternTypes,
  palette,
  resetKey,
  hasActiveFilter,
  onNodeTap,
}) => {
  const styles = getStyles(palette);

  return (
    <>
      <CycleWarning cycles={model.cycles} palette={palette} />

      <View style={styles.viewContainer}>
        {viewMode === "timeline" ? (
          <TimelineView
            key={`timeline-${resetKey}`}
            model={model}
            patternTypes={patternTypes}
            palette={palette}
            hasActiveFilter={hasActiveFilter}
            onNodeTap={onNodeTap}
          />
        ) : (
          <NetworkGraphView
            key={`graph-${resetKey}`}
            model={model}
            palette={palette}
            hasActiveFilter={hasActiveFilter}
            onNodeTap={onNodeTap}
          />
        )}
      </View>

      <Legend palette={palette} patternTypes={patternTypes} />
    </>
  );
};

const getStyles = (palette: Record<PaletteColor, string>) =>
  StyleSheet.create({
    viewContainer: {
      flex: 1,
      backgroundColor: palette[PaletteColor.Background],
    },
  });

export default GraphViewContainer;
