import { WCSPattern } from "@/components/pattern/types/WCSPattern";
import { PaletteColor } from "@/components/common/ColorPalette";
import { LayoutPosition } from "@/components/pattern/graph/utils/GraphUtils";

export interface IGraphSvgProps {
  svgWidth: number;
  svgHeight: number;
  patterns: WCSPattern[];
  positions: IGraphPosition;
  palette: Record<PaletteColor, string>;
  onNodeTap: (pattern: WCSPattern) => void;
  typeColorMap?: Map<string, string>;
}

export type IGraphPosition = Map<number, LayoutPosition>;
