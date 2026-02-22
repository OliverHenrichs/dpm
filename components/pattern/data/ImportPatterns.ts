import { VideoReference } from "@/components/pattern/types/PatternList";
import { getDocumentAsync } from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import {
  IPatternListExportData,
  PatternListWithPatterns,
} from "@/components/pattern/data/types/IExportData";

interface IImportPatternListResult {
  success: boolean;
  cancelled?: boolean;
  patternLists?: PatternListWithPatterns[];
  message: string;
}

/**
 * Import pattern lists from a JSON file
 * - Videos are decoded from base64 and saved locally
 * - URLs are preserved as-is
 * - Returns the imported pattern lists
 */
export async function importPatternLists(): Promise<IImportPatternListResult> {
  try {
    const fileUri = await getImportDocument();
    if (typeof fileUri !== "string") {
      return fileUri;
    }
    const data = await importData(fileUri);
    if (!data.version || !data.patternLists) {
      return createResult(false, "Invalid import file format");
    }

    const warnings: string[] = [];
    const updatedLists: PatternListWithPatterns[] = [];

    for (const list of data.patternLists) {
      const updatedPatterns = [];
      for (const pattern of list.patterns) {
        const videoRefs = await addVideoRefs(
          pattern.id,
          pattern.videoRefs,
          data,
          warnings,
        );
        updatedPatterns.push({
          ...pattern,
          videoRefs,
        });
      }
      updatedLists.push({
        ...list,
        patterns: updatedPatterns,
      });
    }

    return createResult(
      true,
      createSuccessMessage(updatedLists, warnings),
      updatedLists,
    );
  } catch (error) {
    const message = `Import failed: ${error instanceof Error ? error.message : String(error)}`;
    return createResult(false, message);
  }
}

async function getImportDocument() {
  const result = await getDocumentAsync({
    type: "application/json",
    copyToCacheDirectory: true,
  });
  if (result.canceled) {
    return createResult(false, "", undefined, true);
  }
  return result.assets[0].uri;
}

async function importData(fileUri: string) {
  const file = new File(fileUri);
  const content = await file.text();
  const importData: IPatternListExportData = JSON.parse(content);
  return importData;
}

async function tryAddLocalVideoRef(
  data: IPatternListExportData,
  videoRef: VideoReference,
  patternId: number,
  warnings: string[],
): Promise<VideoReference | void> {
  const videoString = data.videos[videoRef.value];
  if (videoString) {
    try {
      const newVideoUri = generateVideoUri(patternId);
      const file = new File(newVideoUri);
      file.write(videoString, { encoding: "base64" });
      return {
        type: "local",
        value: newVideoUri,
      };
    } catch {
      warnings.push(`Failed to restore video for pattern ID ${patternId}`);
    }
  } else {
    warnings.push(`Video data missing for pattern ID ${patternId}`);
  }
}

async function addVideoRefs(
  patternId: number,
  videoRefs: VideoReference[] | undefined,
  data: IPatternListExportData,
  warnings: string[],
) {
  const updatedVideoRefs: VideoReference[] = [];
  for (const videoRef of videoRefs ?? []) {
    if (videoRef.type === "local") {
      const addedVideoRef = await tryAddLocalVideoRef(
        data,
        videoRef,
        patternId,
        warnings,
      );
      if (addedVideoRef) {
        updatedVideoRefs.push(addedVideoRef);
      }
    } else {
      // Keep URL references as-is
      updatedVideoRefs.push(videoRef);
    }
  }
  return updatedVideoRefs;
}

function generateVideoUri(patternId: number) {
  const timestamp = Date.now();
  return `${Paths.document.uri}imported-${patternId}-${timestamp}.mp4`;
}

function createSuccessMessage(
  patternLists: PatternListWithPatterns[],
  warnings: string[],
) {
  const totalPatterns = patternLists.reduce(
    (sum, list) => sum + list.patterns.length,
    0,
  );
  let message = `Successfully imported ${patternLists.length} list(s) with ${totalPatterns} pattern(s)`;
  if (warnings.length > 0) {
    message += `\n\nWarnings:\n${warnings.join("\n")}`;
  }
  return message;
}

function createResult(
  success: boolean,
  message: string,
  patternLists?: PatternListWithPatterns[],
  cancelled?: boolean,
): IImportPatternListResult {
  return {
    success,
    message,
    ...(patternLists && { patternLists }),
    ...(cancelled && { cancelled }),
  };
}
