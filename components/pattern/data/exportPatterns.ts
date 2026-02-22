import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { VideoReference } from "@/components/pattern/types/PatternList";
import {
  exportDataVersion,
  IPatternListExportData,
  PatternListWithPatterns,
} from "@/components/pattern/data/types/IExportData";

interface IVideoList {
  [key: string]: string;
}

/**
 * Export selected pattern lists to a JSON file with embedded videos
 */
export async function exportPatternLists(
  patternLists: PatternListWithPatterns[],
): Promise<{ success: boolean; message: string }> {
  try {
    const warnings: string[] = [];
    const exportData = await createExportData(patternLists, warnings);
    const fileUri = await writeExportData(exportData);

    if (!(await Sharing.isAvailableAsync())) {
      return {
        success: false,
        message: "Sharing is not available on this device",
      };
    }
    return shareExportData(fileUri, patternLists, warnings);
  } catch (error) {
    return {
      success: false,
      message: `Export failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

async function createExportData(
  patternLists: PatternListWithPatterns[],
  warnings: string[],
): Promise<IPatternListExportData> {
  const videos: IVideoList = {};

  // Process videos from all patterns in all lists
  for (const list of patternLists) {
    for (const pattern of list.patterns) {
      await addPatternVideos(pattern.id, pattern.videoRefs, videos, warnings);
    }
  }

  return {
    version: exportDataVersion,
    exportDate: new Date().toISOString(),
    patternLists,
    videos,
  };
}

async function addPatternVideos(
  patternId: number,
  videoRefs: VideoReference[] | undefined,
  videos: IVideoList,
  warnings: string[],
) {
  if (!videoRefs) {
    return;
  }
  for (const videoRef of videoRefs) {
    if (videoRef.type !== "local" || videos[videoRef.value]) {
      continue; // Skip non-local or already processed videos
    }
    const base64Data = await getVideo(videoRef, warnings, patternId);
    if (base64Data) {
      videos[videoRef.value] = base64Data;
    }
  }
}

async function getVideo(
  videoRef: VideoReference,
  warnings: string[],
  patternId: number,
) {
  try {
    const file = new File(videoRef.value);
    if (!file.exists) {
      return;
    }
    return await file.base64();
  } catch {
    warnings.push(
      `Failed to read video: ${videoRef.value} (pattern ID: ${patternId})`,
    );
  }
}

async function writeExportData(exportData: IPatternListExportData) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `pattern-lists-${timestamp}.json`;
  const file = new File(Paths.document, fileName);
  file.write(JSON.stringify(exportData, null, 2));
  return file.uri;
}

async function shareExportData(
  fileUri: string,
  patternLists: PatternListWithPatterns[],
  warnings: string[],
) {
  await Sharing.shareAsync(fileUri, {
    mimeType: "application/json",
    dialogTitle: "Export Pattern Lists",
    UTI: "public.json",
  });
  return {
    success: true,
    message: createSuccessMessage(patternLists, warnings),
  };
}

function createSuccessMessage(
  patternLists: PatternListWithPatterns[],
  warnings: string[],
) {
  const totalPatterns = patternLists.reduce(
    (sum, list) => sum + list.patterns.length,
    0,
  );
  let message = `Successfully exported ${patternLists.length} list(s) with ${totalPatterns} pattern(s)`;
  if (warnings.length > 0) {
    message += `\n\nWarnings:\n${warnings.join("\n")}`;
  }
  return message;
}
