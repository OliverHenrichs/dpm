import {
  IModifier,
  IPattern,
  IPatternModifierRef,
  IVideoReference,
  ModifierPosition,
} from "@/src/pattern/types/IPatternList";
import { PatternType } from "@/src/pattern/types/PatternType";
import {
  IPatternListExportData,
  PatternListWithPatterns,
} from "@/src/pattern/data/types/IExportData";
import { canImport } from "@/src/pattern/data/types/ExportVersion";

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
 *   (see AGENTS.md, "Prerequisite integrity").
 *
 * The returned `data` is a normalised copy: every optional field filled in,
 * every reference resolvable. Nothing downstream needs to re-check it.
 */
export interface ExportValidationResult {
  valid: boolean;
  /** Fatal problems. Non-empty means nothing should be imported. */
  errors: string[];
  /** Repairs that were applied. The import can proceed. */
  warnings: string[];
  /** Present only when `valid`. Normalised and safe to persist. */
  data?: IPatternListExportData;
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const isNonEmptyString = (v: unknown): v is string =>
  typeof v === "string" && v.trim().length > 0;

/** Integers only: ids index into arrays and are compared with `===`. */
const isInteger = (v: unknown): v is number =>
  typeof v === "number" && Number.isInteger(v);

const asString = (v: unknown, fallback: string): string =>
  typeof v === "string" ? v : fallback;

const asStringArray = (v: unknown): string[] =>
  Array.isArray(v)
    ? v.filter((item): item is string => typeof item === "string")
    : [];

const MODIFIER_POSITIONS: ModifierPosition[] = ["prefix", "postfix", "amends"];

function normalizeVideoRefs(raw: unknown, where: string, warnings: string[]) {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) {
    warnings.push(`${where}: videos were not a list and have been dropped`);
    return [];
  }
  const refs: IVideoReference[] = [];
  for (const entry of raw) {
    if (
      !isObject(entry) ||
      (entry.type !== "url" && entry.type !== "local") ||
      !isNonEmptyString(entry.value)
    ) {
      warnings.push(`${where}: dropped a malformed video reference`);
      continue;
    }
    const ref: IVideoReference = {
      type: entry.type,
      value: entry.value,
    };
    // A non-numeric start time is dropped rather than rejected — the video
    // still plays, just from the beginning.
    if (
      typeof entry.startTime === "number" &&
      Number.isFinite(entry.startTime)
    ) {
      ref.startTime = entry.startTime;
    }
    refs.push(ref);
  }
  return refs;
}

function normalizePatternTypes(
  raw: unknown,
  listLabel: string,
  warnings: string[],
): PatternType[] {
  if (!Array.isArray(raw)) {
    warnings.push(`${listLabel}: pattern types were missing`);
    return [];
  }
  const types: PatternType[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    if (!isObject(entry) || !isNonEmptyString(entry.id)) {
      warnings.push(`${listLabel}: dropped a pattern type with no id`);
      continue;
    }
    if (seen.has(entry.id)) {
      warnings.push(`${listLabel}: dropped a duplicate pattern type`);
      continue;
    }
    seen.add(entry.id);
    types.push({
      id: entry.id,
      slug: asString(entry.slug, ""),
      color: asString(entry.color, ""),
    });
  }
  return types;
}

function normalizeModifiers(
  raw: unknown,
  listLabel: string,
  warnings: string[],
): IModifier[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) {
    warnings.push(`${listLabel}: modifiers were not a list`);
    return [];
  }
  const modifiers: IModifier[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    if (!isObject(entry) || !isNonEmptyString(entry.id)) {
      warnings.push(`${listLabel}: dropped a modifier with no id`);
      continue;
    }
    if (seen.has(entry.id)) {
      warnings.push(`${listLabel}: dropped a duplicate modifier`);
      continue;
    }
    seen.add(entry.id);
    const position = MODIFIER_POSITIONS.includes(
      entry.position as ModifierPosition,
    )
      ? (entry.position as ModifierPosition)
      : "amends";
    modifiers.push({
      id: entry.id,
      name: asString(entry.name, ""),
      position,
      universal: entry.universal === true,
      videoRefs: normalizeVideoRefs(
        entry.videoRefs,
        `${listLabel}: modifier "${asString(entry.name, entry.id)}"`,
        warnings,
      ),
    });
  }
  return modifiers;
}

function normalizeModifierRefs(
  raw: unknown,
  knownModifierIds: Set<string>,
  where: string,
  warnings: string[],
): IPatternModifierRef[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) {
    warnings.push(`${where}: modifier attachments were not a list`);
    return [];
  }
  const refs: IPatternModifierRef[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    if (!isObject(entry) || !isNonEmptyString(entry.modifierId)) {
      warnings.push(`${where}: dropped a modifier attachment with no id`);
      continue;
    }
    if (!knownModifierIds.has(entry.modifierId)) {
      warnings.push(
        `${where}: dropped an attachment to a modifier that is not in the list`,
      );
      continue;
    }
    if (seen.has(entry.modifierId)) {
      warnings.push(`${where}: dropped a duplicate modifier attachment`);
      continue;
    }
    seen.add(entry.modifierId);
    refs.push({
      modifierId: entry.modifierId,
      videoRefs: normalizeVideoRefs(entry.videoRefs, where, warnings),
    });
  }
  return refs;
}

/**
 * Patterns are validated in two passes: the first normalises each one and
 * drops anything unusable, the second resolves prerequisites — which can only
 * be checked once the surviving set is known.
 */
function normalizePatterns(
  raw: unknown,
  types: PatternType[],
  modifiers: IModifier[],
  listLabel: string,
  errors: string[],
  warnings: string[],
): IPattern[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) {
    errors.push(`${listLabel}: patterns were not a list`);
    return [];
  }

  const knownTypeIds = new Set(types.map((t) => t.id));
  const knownModifierIds = new Set(modifiers.map((m) => m.id));
  const fallbackTypeId = types[0]?.id ?? "";

  const firstPass: IPattern[] = [];
  const seenIds = new Set<number>();

  for (const entry of raw) {
    if (!isObject(entry) || !isInteger(entry.id)) {
      errors.push(`${listLabel}: a pattern has no usable id`);
      continue;
    }
    const label = `${listLabel}: pattern "${asString(entry.name, String(entry.id))}"`;
    if (seenIds.has(entry.id)) {
      errors.push(`${listLabel}: two patterns share the id ${entry.id}`);
      continue;
    }
    seenIds.add(entry.id);

    let typeId = asString(entry.typeId, "");
    if (!knownTypeIds.has(typeId)) {
      warnings.push(`${label}: its pattern type is not in the list`);
      typeId = fallbackTypeId;
    }

    const prerequisites = Array.isArray(entry.prerequisites)
      ? entry.prerequisites.filter(isInteger)
      : [];
    if (
      Array.isArray(entry.prerequisites) &&
      prerequisites.length !== entry.prerequisites.length
    ) {
      warnings.push(`${label}: dropped a prerequisite that was not a number`);
    } else if (!Array.isArray(entry.prerequisites)) {
      warnings.push(`${label}: prerequisites were missing`);
    }

    firstPass.push({
      id: entry.id,
      name: asString(entry.name, ""),
      typeId,
      counts: typeof entry.counts === "number" ? entry.counts : 0,
      ...(typeof entry.level === "string" && { level: entry.level }),
      prerequisites,
      description: asString(entry.description, ""),
      tags: asStringArray(entry.tags),
      videoRefs: normalizeVideoRefs(entry.videoRefs, label, warnings),
      modifierRefs: normalizeModifierRefs(
        entry.modifierRefs,
        knownModifierIds,
        label,
        warnings,
      ),
    });
  }

  // Second pass: a prerequisite can only be checked against the survivors.
  const survivingIds = new Set(firstPass.map((p) => p.id));
  return firstPass.map((pattern) => {
    const kept = pattern.prerequisites.filter(
      (id) => survivingIds.has(id) && id !== pattern.id,
    );
    if (kept.length !== pattern.prerequisites.length) {
      warnings.push(
        `${listLabel}: pattern "${pattern.name}" referenced a prerequisite that is not in the file`,
      );
    }
    return kept.length === pattern.prerequisites.length
      ? pattern
      : { ...pattern, prerequisites: kept };
  });
}

function normalizeList(
  raw: unknown,
  index: number,
  errors: string[],
  warnings: string[],
): PatternListWithPatterns | null {
  if (!isObject(raw)) {
    errors.push(`List ${index + 1} is not an object`);
    return null;
  }
  if (!isNonEmptyString(raw.id)) {
    errors.push(`List ${index + 1} has no id`);
    return null;
  }
  const label = `List "${asString(raw.name, raw.id)}"`;

  const patternTypes = normalizePatternTypes(raw.patternTypes, label, warnings);
  const modifiers = normalizeModifiers(raw.modifiers, label, warnings);
  const patterns = normalizePatterns(
    raw.patterns,
    patternTypes,
    modifiers,
    label,
    errors,
    warnings,
  );

  const now = Date.now();
  return {
    id: raw.id,
    name: asString(raw.name, ""),
    patternTypes,
    modifiers,
    createdAt: typeof raw.createdAt === "number" ? raw.createdAt : now,
    updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : now,
    ...(raw.readonly === true && { readonly: true as const }),
    ...(isNonEmptyString(raw.shareCode) && { shareCode: raw.shareCode }),
    patterns,
  };
}

function normalizeVideoMap(
  raw: unknown,
  warnings: string[],
): Record<string, string> {
  if (raw === undefined) return {};
  if (!isObject(raw)) {
    warnings.push("The embedded video data was not readable and was ignored");
    return {};
  }
  const videos: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") videos[key] = value;
    else warnings.push(`Dropped unreadable video data for "${key}"`);
  }
  return videos;
}

export function validateExportData(raw: unknown): ExportValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isObject(raw)) {
    return {
      valid: false,
      errors: ["The file is not a pattern list export"],
      warnings,
    };
  }

  const compatibility = canImport(raw.version);
  if (!compatibility.supported) {
    const message =
      compatibility.reason === "tooNew"
        ? "This file was made by a newer version of the app. Update to import it."
        : compatibility.reason === "tooOld"
          ? "This file was made by a version of the app that is no longer supported."
          : "The file is not a pattern list export";
    return { valid: false, errors: [message], warnings };
  }

  if (!Array.isArray(raw.patternLists)) {
    return {
      valid: false,
      errors: ["The file contains no pattern lists"],
      warnings,
    };
  }

  const lists: PatternListWithPatterns[] = [];
  const seenListIds = new Set<string>();
  raw.patternLists.forEach((entry, index) => {
    const list = normalizeList(entry, index, errors, warnings);
    if (!list) return;
    if (seenListIds.has(list.id)) {
      errors.push(`Two lists in the file share the id ${list.id}`);
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
