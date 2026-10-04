import { IVideoReference } from "@/src/pattern/types/IPatternList";
import { getDocumentAsync } from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import {
  IPatternListExportData,
  PatternListWithPatterns,
} from "@/src/pattern/data/types/IExportData";
import { generateUUID } from "@/src/pattern/types/PatternType";
import { validateExportData } from "@/src/pattern/data/validation/validateExportData";
import {
  ImportMessage,
  ImportMessageContext,
  importMessage as msg,
} from "@/src/pattern/data/validation/importMessages";

interface IImportPatternListResult {
  success: boolean;
  cancelled?: boolean;
  patternLists?: PatternListWithPatterns[];
  /** Why nothing was imported. Translate with `formatImportMessages`. */
  errors: ImportMessage[];
  /** What was repaired or left behind on the way. */
  warnings: ImportMessage[];
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
    const parsed = await importData(fileUri);

    // Everything after this point writes to storage and then to the screen,
    // and the file came from a document picker — i.e. from anywhere. Validate
    // before trusting any of it. `data` comes back normalised: optional fields
    // filled in, references resolvable, malformed entries already dropped.
    const validation = validateExportData(parsed);
    if (!validation.valid || !validation.data) {
      return createResult(false, validation.errors);
    }
    const data = validation.data;

    const warnings: ImportMessage[] = [...validation.warnings];
    const updatedLists: PatternListWithPatterns[] = [];

    for (const list of data.patternLists) {
      // Restore universal modifier videos
      const updatedModifiers = [];
      for (const modifier of list.modifiers ?? []) {
        const videoRefs = await addVideoRefs(
          `modifier:${modifier.id}`,
          { list: list.name, modifier: modifier.name },
          modifier.videoRefs,
          data,
          warnings,
        );
        updatedModifiers.push({ ...modifier, videoRefs });
      }

      const updatedPatterns = [];
      for (const pattern of list.patterns) {
        const where = { list: list.name, pattern: pattern.name };
        const videoRefs = await addVideoRefs(
          `pattern:${pattern.id}`,
          where,
          pattern.videoRefs,
          data,
          warnings,
        );
        // Restore per-pattern modifier combination videos
        const updatedModifierRefs = [];
        for (const modRef of pattern.modifierRefs ?? []) {
          const modRefVideoRefs = await addVideoRefs(
            `pattern:${pattern.id}+modifier:${modRef.modifierId}`,
            where,
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

    return createResult(true, [], warnings, updatedLists);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return createResult(false, [msg("importFailed", { error: reason })]);
  }
}

async function getImportDocument() {
  const result = await getDocumentAsync({
    type: "application/json",
    copyToCacheDirectory: true,
  });
  if (result.canceled) {
    return createResult(false, [], [], undefined, true);
  }
  return result.assets[0].uri;
}

/** Read and parse the picked file. Shape checking happens separately. */
async function importData(fileUri: string): Promise<unknown> {
  const file = new File(fileUri);
  const content = await file.text();
  return JSON.parse(content);
}

async function tryAddLocalVideoRef(
  data: IPatternListExportData,
  videoRef: IVideoReference,
  contextId: string,
  where: ImportMessageContext,
  warnings: ImportMessage[],
): Promise<IVideoReference | void> {
  const videoString = data.videos[videoRef.value];
  if (videoString) {
    try {
      const newVideoUri = generateVideoUri(contextId);
      const file = new File(newVideoUri);
      file.write(videoString, { encoding: "base64" });
      // Spread, not rebuilt: provenance (`generated`) must survive the trip.
      return { ...videoRef, type: "local", value: newVideoUri };
    } catch {
      warnings.push(msg("importWarnVideoRestoreFailed", undefined, where));
    }
  } else if (data.includesVideos) {
    warnings.push(msg("importWarnVideoDataMissing", undefined, where));
  }
  // When includesVideos === false the local ref was intentionally stripped — silently skip it
}

async function addVideoRefs(
  contextId: string,
  where: ImportMessageContext,
  videoRefs: IVideoReference[] | undefined,
  data: IPatternListExportData,
  warnings: ImportMessage[],
) {
  const updatedVideoRefs: IVideoReference[] = [];
  for (const videoRef of videoRefs ?? []) {
    if (videoRef.type === "local") {
      const addedVideoRef = await tryAddLocalVideoRef(
        data,
        videoRef,
        contextId,
        where,
        warnings,
      );
      if (addedVideoRef) updatedVideoRefs.push(addedVideoRef);
    } else {
      updatedVideoRefs.push(videoRef);
    }
  }
  return updatedVideoRefs;
}

/**
 * Build the on-device path for a restored video.
 *
 * The suffix must be unique **per video**, not per context: `contextId` is the
 * same string for every video of a pattern, so anything derived only from it —
 * `Date.now()`, as this used to use — collides. The restore loop is tight and
 * the writes are synchronous, so two videos of one pattern reliably landed in
 * the same millisecond, the second overwriting the first and both refs ending
 * up on one file. Pattern ids are also only unique within a list, so two lists
 * in one import file collided the same way.
 *
 * `contextId` is kept in the name purely so the files stay identifiable on
 * disk; uniqueness comes from the UUID alone.
 */
function generateVideoUri(contextId: string) {
  const safeId = contextId.replace(/[^a-zA-Z0-9]/g, "_");
  return `${Paths.document.uri}imported-${safeId}-${generateUUID()}.mp4`;
}

function createResult(
  success: boolean,
  errors: ImportMessage[],
  warnings: ImportMessage[] = [],
  patternLists?: PatternListWithPatterns[],
  cancelled?: boolean,
): IImportPatternListResult {
  return {
    success,
    errors,
    warnings,
    ...(patternLists && { patternLists }),
    ...(cancelled && { cancelled }),
  };
}
