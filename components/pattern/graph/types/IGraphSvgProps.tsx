import { PaletteColor } from "@/components/common/ColorPalette";
import { LayoutPosition } from "@/components/pattern/graph/utils/GraphUtils";
import { Pattern } from "@/components/pattern/types/PatternList";

export interface IGraphSvgProps {
  svgWidth: number;
  svgHeight: number;
  patterns: Pattern[];
  positions: IGraphPosition;
  palette: Record<PaletteColor, string>;
  onNodeTap: (pattern: Pattern) => void;
  typeColorMap?: Map<string, string>;
}

export type IGraphPosition = Map<number, LayoutPosition>;
