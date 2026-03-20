import { Pattern, PatternList } from "@/components/pattern/types/PatternList";

export const exportDataVersion = "2.0.0";

export interface PatternListWithPatterns extends PatternList {
  patterns: Pattern[]; // Patterns are included for export
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
