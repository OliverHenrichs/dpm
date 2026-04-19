import { IPattern, IPatternList } from "@/src/pattern/types/IPatternList";

export const exportDataVersion = "3.0.0";

export interface PatternListWithPatterns extends IPatternList {
  patterns: IPattern[]; // Patterns are included for export
}

export interface IPatternListExportData {
  version: string;
  exportDate: string;
  includesVideos: boolean; // false when user opted out of embedding local videos
  patternLists: PatternListWithPatterns[];
  videos: {
    [key: string]: string; // key: original local path, value: base64 encoded video
  };
}
