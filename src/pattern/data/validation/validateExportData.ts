import { canImport } from "@/src/pattern/data/types/ExportVersion";
import {
  IPatternListExportData,
  PatternListWithPatterns,
} from "@/src/pattern/data/types/IExportData";
import {
  ImportMessage,
  importMessage as msg,
} from "@/src/pattern/data/validation/importMessages";
import {
  asString,
  isObject,
  normalizeList,
} from "@/src/pattern/data/validation/normalizeList";

/**
 * Validate and repair an import payload.
 *
 * The file comes from a document picker, which means it comes from anywhere.
 * Before this existed the importer checked only that `version` and
 * `patternLists` were truthy and then trusted everything after, writing it
 * straight into storage and from there into the UI.
 *
 * Two classes of problem, treated differently:
 *
 * - **Fatal** — the shape is wrong in a way no sensible repair can fix: not an
 *   object, an unsupported version, `patternLists` not an array, a list with
 *   no usable `id`, a pattern whose `id` is not a number. These reject the
 *   whole file, because importing half of it is worse than importing none.
 * - **Repairable** — something inside is inconsistent but the rest is fine: a
 *   pattern pointing at a type that is not in its list, a prerequisite id that
 *   matches no pattern, a malformed video reference. These are cleaned and
 *   reported as warnings, matching what the storage layer already does on read
 *   (see src/pattern/graph/AGENTS.md, "Prerequisite integrity").
 *
 * Problems are reported as i18n keys (`ImportMessage`), not English: the
 * screen translates them with `formatImportMessages`.
 *
 * The returned `data` is a normalised copy: every optional field filled in,
 * every reference resolvable. Nothing downstream needs to re-check it.
 */
export interface ExportValidationResult {
  valid: boolean;
  /** Fatal problems. Non-empty means nothing should be imported. */
  errors: ImportMessage[];
  /** Repairs that were applied. The import can proceed. */
  warnings: ImportMessage[];
  /** Present only when `valid`. Normalised and safe to persist. */
  data?: IPatternListExportData;
}

function normalizeVideoMap(
  raw: unknown,
  warnings: ImportMessage[],
): Record<string, string> {
  if (raw === undefined) return {};
  if (!isObject(raw)) {
    warnings.push(msg("importWarnVideoDataUnreadable"));
    return {};
  }
  const videos: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") videos[key] = value;
    else warnings.push(msg("importWarnVideoEntryUnreadable", { path: key }));
  }
  return videos;
}

export function validateExportData(raw: unknown): ExportValidationResult {
  const errors: ImportMessage[] = [];
  const warnings: ImportMessage[] = [];

  if (!isObject(raw)) {
    return {
      valid: false,
      errors: [msg("importErrorNotAnExport")],
      warnings,
    };
  }

  const compatibility = canImport(raw.version);
  if (!compatibility.supported) {
    const key =
      compatibility.reason === "tooNew"
        ? "importErrorTooNew"
        : compatibility.reason === "tooOld"
          ? "importErrorTooOld"
          : "importErrorNotAnExport";
    return { valid: false, errors: [msg(key)], warnings };
  }

  if (!Array.isArray(raw.patternLists)) {
    return {
      valid: false,
      errors: [msg("importErrorNoLists")],
      warnings,
    };
  }

  const lists: PatternListWithPatterns[] = [];
  const seenListIds = new Set<string>();
  raw.patternLists.forEach((entry, index) => {
    const list = normalizeList(entry, index, errors, warnings);
    if (!list) return;
    if (seenListIds.has(list.id)) {
      errors.push(msg("importErrorDuplicateListId", { id: list.id }));
      return;
    }
    seenListIds.add(list.id);
    lists.push(list);
  });

  if (errors.length > 0) return { valid: false, errors, warnings };

  return {
    valid: true,
    errors,
    warnings,
    data: {
      version: raw.version as string,
      exportDate: asString(raw.exportDate, ""),
      includesVideos: raw.includesVideos === true,
      patternLists: lists,
      videos: normalizeVideoMap(raw.videos, warnings),
    },
  };
}
