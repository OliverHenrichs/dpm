import { PaletteColor } from "@/src/common/utils/ColorPalette";
import { LayoutPosition } from "@/src/pattern/graph/utils/GraphUtils";
import { IPattern } from "@/src/pattern/types/IPatternList";
import { GraphModel } from "@/src/pattern/graph/model/GraphModel";

export interface IGraphSvgProps {
  svgWidth: number;
  svgHeight: number;
  /** Nodes, edges and colours, all decided in one place. */
  model: GraphModel;
  positions: IGraphPosition;
  palette: Record<PaletteColor, string>;
  onNodeTap: (pattern: IPattern) => void;
}

export type IGraphPosition = Map<number, LayoutPosition>;
