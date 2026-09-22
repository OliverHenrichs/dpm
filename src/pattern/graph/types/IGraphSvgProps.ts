import { PaletteColor } from "@/src/common/utils/ColorPalette";
import { LayoutPosition } from "@/src/pattern/graph/utils/GraphUtils";
import { IPattern } from "@/src/pattern/types/IPatternList";
import { GraphModel } from "@/src/pattern/graph/model/GraphModel";
import { SharedValue } from "react-native-reanimated";

export interface IGraphSvgProps {
  svgWidth: number;
  svgHeight: number;
  /** Nodes, edges and colours, all decided in one place. */
  model: GraphModel;
  positions: IGraphPosition;
  palette: Record<PaletteColor, string>;
  /**
   * The node being dragged, if any. Only this node and the edges touching it
   * follow a shared value; everything else is drawn statically, so a drag
   * costs a handful of worklets per frame rather than one per node.
   */
  draggingId?: number | null;
  dragX?: SharedValue<number>;
  dragY?: SharedValue<number>;
  onNodeTap: (pattern: IPattern) => void;
}

export type IGraphPosition = Map<number, LayoutPosition>;
