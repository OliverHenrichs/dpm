import { withoutTranscripts } from "@/src/pattern/data/transcripts";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { IPattern, IVideoReference } from "@/src/pattern/types/IPatternList";
import {
  exportDataVersion,
  IPatternListExportData,
  PatternListWithPatterns,
} from "@/src/pattern/data/types/IExportData";

interface IVideoList {
  [key: string]: string;
}

export interface ExportOptions {
  /** Embed local videos; without them their references are dropped. Default true. */
  includeVideos?: boolean;
  /** Mark every list read-only for whoever imports it. Default false. */
  exportAsReadonly?: boolean;
  /**
   * Keep the transcripts of the videos that travel (L4). Default false: a transcript is someone's
   * words in writing, and sending a list should not pass on what a teacher said off-hand unless
   * the user chose to. Without videos there is nothing for a transcript to sit on.
   */
  includeTranscripts?: boolean;
}

/**
 * Export selected pattern lists to a JSON file with embedded videos
 * Note: Always returns success=true after sharing dialog is opened, as the native
 * sharing API does not distinguish between user cancellation and successful sharing
 */
export async function exportPatternLists(
  patternLists: PatternListWithPatterns[],
  {
    includeVideos = true,
    exportAsReadonly = false,
    includeTranscripts = false,
  }: ExportOptions = {},
): Promise<{ success: boolean; message: string }> {
  try {
    const warnings: string[] = [];
    const exportData = await createExportData(
      patternLists,
      warnings,
      includeVideos,
      exportAsReadonly,
      includeVideos && includeTranscripts,
    );
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
  includeVideos: boolean,
  exportAsReadonly: boolean,
  includeTranscripts: boolean,
): Promise<IPatternListExportData> {
  const videos: IVideoList = {};
  const transcripts = <T extends Pick<IPattern, "videoRefs" | "modifierRefs">>(
    pattern: T,
  ) => (includeTranscripts ? pattern : withoutTranscripts(pattern));

  // Embeds a group's local videos, keyed by their original path, or with `includeVideos` off
  // drops them: a path on this phone means nothing on another.
  const portable = async (
    refs: IVideoReference[] | undefined,
    context: string,
  ): Promise<IVideoReference[]> => {
    if (!includeVideos) return (refs ?? []).filter((r) => r.type !== "local");
    for (const videoRef of refs ?? []) {
      if (videoRef.type !== "local" || videos[videoRef.value]) continue;
      const base64Data = await getVideo(videoRef, warnings, context);
      if (base64Data) videos[videoRef.value] = base64Data;
    }
    return refs ?? [];
  };

  const exportedLists: PatternListWithPatterns[] = [];
  for (const list of patternLists) {
    // Universal modifiers' own videos
    const exportedModifiers = [];
    for (const modifier of list.modifiers ?? []) {
      const videoRefs = await portable(
        modifier.videoRefs,
        `modifier:${modifier.id}`,
      );
      exportedModifiers.push(
        includeVideos ? modifier : { ...modifier, videoRefs },
      );
    }

    const exportedPatterns = [];
    for (const pattern of list.patterns) {
      const videoRefs = await portable(
        pattern.videoRefs,
        `pattern:${pattern.id}`,
      );
      // Each modifier combination's videos
      const modifierRefs = [];
      for (const modRef of pattern.modifierRefs ?? []) {
        const refs = await portable(
          modRef.videoRefs,
          `pattern:${pattern.id}+modifier:${modRef.modifierId}`,
        );
        modifierRefs.push(
          includeVideos ? modRef : { ...modRef, videoRefs: refs },
        );
      }
      exportedPatterns.push(
        includeVideos
          ? transcripts({ ...pattern, modifierRefs })
          : withoutTranscripts({
              ...pattern,
              videoRefs: videoRefs,
              modifierRefs,
            }),
      );
    }
    exportedLists.push({
      ...list,
      modifiers: exportedModifiers,
      readonly: exportAsReadonly ? true : undefined,
      // The share key lets whoever holds it take over the published list. An
      // editable export is how the publisher moves the list to a new phone; a
      // read-only one goes to other people, so it must not carry the key.
      shareKey: exportAsReadonly ? undefined : list.shareKey,
      patterns: exportedPatterns,
    });
  }

  return {
    version: exportDataVersion,
    exportDate: new Date().toISOString(),
    includesVideos: includeVideos,
    includesTranscripts: includeTranscripts,
    patternLists: exportedLists,
    videos,
  };
}

async function getVideo(
  videoRef: IVideoReference,
  warnings: string[],
  context: string,
) {
  try {
    const file = new File(videoRef.value);
    if (!file.exists) return;
    return await file.base64();
  } catch {
    warnings.push(
      `Failed to read video: ${videoRef.value} (context: ${context})`,
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
