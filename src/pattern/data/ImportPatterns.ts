import { IVideoReference } from "@/src/pattern/types/IPatternList";
import { getDocumentAsync } from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import {
  IPatternListExportData,
  PatternListWithPatterns,
} from "@/src/pattern/data/types/IExportData";

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
      // Restore universal modifier videos
      const updatedModifiers = [];
      for (const modifier of list.modifiers ?? []) {
        const videoRefs = await addVideoRefs(
          `modifier:${modifier.id}`,
          modifier.videoRefs,
          data,
          warnings,
        );
        updatedModifiers.push({ ...modifier, videoRefs });
      }

      const updatedPatterns = [];
      for (const pattern of list.patterns) {
        const videoRefs = await addVideoRefs(
          `pattern:${pattern.id}`,
          pattern.videoRefs,
          data,
          warnings,
        );
        // Restore per-pattern modifier combination videos
        const updatedModifierRefs = [];
        for (const modRef of pattern.modifierRefs ?? []) {
          const modRefVideoRefs = await addVideoRefs(
            `pattern:${pattern.id}+modifier:${modRef.modifierId}`,
            modRef.videoRefs,
            data,
            warnings,
          );
          updatedModifierRefs.push({ ...modRef, videoRefs: modRefVideoRefs });
        }
        updatedPatterns.push({
          ...pattern,
          videoRefs,
          modifierRefs: updatedModifierRefs,
        });
      }
      updatedLists.push({
        ...list,
        modifiers: updatedModifiers,
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
  videoRef: IVideoReference,
  contextId: string,
  warnings: string[],
): Promise<IVideoReference | void> {
  const videoString = data.videos[videoRef.value];
  if (videoString) {
    try {
      const newVideoUri = generateVideoUri(contextId);
      const file = new File(newVideoUri);
      file.write(videoString, { encoding: "base64" });
      return { type: "local", value: newVideoUri };
    } catch {
      warnings.push(`Failed to restore video for context: ${contextId}`);
    }
  } else if (data.includesVideos) {
    warnings.push(`Video data missing for context: ${contextId}`);
  }
  // When includesVideos === false the local ref was intentionally stripped — silently skip it
}

async function addVideoRefs(
  contextId: string,
  videoRefs: IVideoReference[] | undefined,
  data: IPatternListExportData,
  warnings: string[],
) {
  const updatedVideoRefs: IVideoReference[] = [];
  for (const videoRef of videoRefs ?? []) {
    if (videoRef.type === "local") {
      const addedVideoRef = await tryAddLocalVideoRef(
        data,
        videoRef,
        contextId,
        warnings,
      );
      if (addedVideoRef) updatedVideoRefs.push(addedVideoRef);
    } else {
      updatedVideoRefs.push(videoRef);
    }
  }
  return updatedVideoRefs;
}

function generateVideoUri(contextId: string) {
  const timestamp = Date.now();
  const safeId = contextId.replace(/[^a-zA-Z0-9]/g, "_");
  return `${Paths.document.uri}imported-${safeId}-${timestamp}.mp4`;
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
