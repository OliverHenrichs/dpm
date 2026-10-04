import { isDance } from "@/src/pattern/types/Dance";
import {
  normalizeRhythm,
  rhythmMatchesCounts,
} from "@/src/pattern/rhythm/rhythm";
import {
  IModifier,
  IPattern,
  IPatternModifierRef,
  ITranscriptSegment,
  IVideoReference,
  IVideoTranscript,
  ModifierPosition,
} from "@/src/pattern/types/IPatternList";
import { PatternType } from "@/src/pattern/types/PatternType";
import {
  IPatternListExportData,
  PatternListWithPatterns,
} from "@/src/pattern/data/types/IExportData";
import { canImport } from "@/src/pattern/data/types/ExportVersion";
import {
  ImportMessage,
  ImportMessageContext,
  importMessage as msg,
} from "@/src/pattern/data/validation/importMessages";

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

function normalizeVideoRefs(
  raw: unknown,
  where: ImportMessageContext,
  warnings: ImportMessage[],
) {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) {
    warnings.push(msg("importWarnVideosNotList", undefined, where));
    return [];
  }
  const refs: IVideoReference[] = [];
  for (const entry of raw) {
    if (
      !isObject(entry) ||
      (entry.type !== "url" && entry.type !== "local") ||
      !isNonEmptyString(entry.value)
    ) {
      warnings.push(msg("importWarnMalformedVideo", undefined, where));
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
    // Provenance is kept only when well-formed; the video itself is fine either way.
    if (entry.generated !== undefined) {
      const g = entry.generated;
      if (
        isObject(g) &&
        isNonEmptyString(g.method) &&
        typeof g.createdAt === "number" &&
        Number.isFinite(g.createdAt)
      ) {
        ref.generated = { method: g.method, createdAt: g.createdAt };
      } else {
        warnings.push(msg("importWarnMalformedProvenance", undefined, where));
      }
    }
    // What was said in it (3.2): kept when it is a transcript at all, minus any line that is
    // not one; the video itself is fine either way.
    if (entry.transcript !== undefined) {
      const transcript = normalizeTranscript(entry.transcript, where, warnings);
      if (transcript) ref.transcript = transcript;
    }
    refs.push(ref);
  }
  return refs;
}

const isFiniteNumber = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);

function normalizeTranscript(
  raw: unknown,
  where: ImportMessageContext,
  warnings: ImportMessage[],
): IVideoTranscript | undefined {
  if (
    !isObject(raw) ||
    !isNonEmptyString(raw.language) ||
    !isNonEmptyString(raw.model) ||
    !isFiniteNumber(raw.createdAt) ||
    !Array.isArray(raw.segments)
  ) {
    warnings.push(msg("importWarnMalformedTranscript", undefined, where));
    return undefined;
  }
  const segments: ITranscriptSegment[] = [];
  let dropped = 0;
  for (const s of raw.segments) {
    if (
      isObject(s) &&
      isFiniteNumber(s.start) &&
      isFiniteNumber(s.end) &&
      s.start >= 0 &&
      s.end >= s.start &&
      typeof s.text === "string"
    ) {
      segments.push({ start: s.start, end: s.end, text: s.text });
    } else {
      dropped++;
    }
  }
  if (dropped > 0) {
    warnings.push(
      msg("importWarnMalformedTranscriptLines", { count: dropped }, where),
    );
  }
  return {
    language: raw.language,
    model: raw.model,
    createdAt: raw.createdAt,
    segments: segments.sort((a, b) => a.start - b.start),
  };
}

function normalizePatternTypes(
  raw: unknown,
  where: ImportMessageContext,
  warnings: ImportMessage[],
): PatternType[] {
  if (!Array.isArray(raw)) {
    warnings.push(msg("importWarnTypesMissing", undefined, where));
    return [];
  }
  const types: PatternType[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    if (!isObject(entry) || !isNonEmptyString(entry.id)) {
      warnings.push(msg("importWarnTypeNoId", undefined, where));
      continue;
    }
    if (seen.has(entry.id)) {
      warnings.push(msg("importWarnDuplicateType", undefined, where));
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
  where: ImportMessageContext,
  warnings: ImportMessage[],
): IModifier[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) {
    warnings.push(msg("importWarnModifiersNotList", undefined, where));
    return [];
  }
  const modifiers: IModifier[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    if (!isObject(entry) || !isNonEmptyString(entry.id)) {
      warnings.push(msg("importWarnModifierNoId", undefined, where));
      continue;
    }
    if (seen.has(entry.id)) {
      warnings.push(msg("importWarnDuplicateModifier", undefined, where));
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
        { list: where.list, modifier: asString(entry.name, entry.id) },
        warnings,
      ),
    });
  }
  return modifiers;
}

function normalizeModifierRefs(
  raw: unknown,
  knownModifierIds: Set<string>,
  where: ImportMessageContext,
  warnings: ImportMessage[],
): IPatternModifierRef[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) {
    warnings.push(msg("importWarnModifierRefsNotList", undefined, where));
    return [];
  }
  const refs: IPatternModifierRef[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    if (!isObject(entry) || !isNonEmptyString(entry.modifierId)) {
      warnings.push(msg("importWarnModifierRefNoId", undefined, where));
      continue;
    }
    if (!knownModifierIds.has(entry.modifierId)) {
      warnings.push(msg("importWarnModifierRefUnknown", undefined, where));
      continue;
    }
    if (seen.has(entry.modifierId)) {
      warnings.push(msg("importWarnDuplicateModifierRef", undefined, where));
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
  where: ImportMessageContext,
  errors: ImportMessage[],
  warnings: ImportMessage[],
): IPattern[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) {
    errors.push(msg("importErrorPatternsNotList", undefined, where));
    return [];
  }

  const knownTypeIds = new Set(types.map((t) => t.id));
  const knownModifierIds = new Set(modifiers.map((m) => m.id));
  const fallbackTypeId = types[0]?.id ?? "";

  const firstPass: IPattern[] = [];
  const seenIds = new Set<number>();

  for (const entry of raw) {
    if (!isObject(entry) || !isInteger(entry.id)) {
      errors.push(msg("importErrorPatternNoId", undefined, where));
      continue;
    }
    const label: ImportMessageContext = {
      list: where.list,
      pattern: asString(entry.name, String(entry.id)),
    };
    if (seenIds.has(entry.id)) {
      errors.push(
        msg("importErrorDuplicatePatternId", { id: entry.id }, where),
      );
      continue;
    }
    seenIds.add(entry.id);

    let typeId = asString(entry.typeId, "");
    if (!knownTypeIds.has(typeId)) {
      warnings.push(msg("importWarnUnknownType", undefined, label));
      typeId = fallbackTypeId;
    }

    const prerequisites = Array.isArray(entry.prerequisites)
      ? entry.prerequisites.filter(isInteger)
      : [];
    if (
      Array.isArray(entry.prerequisites) &&
      prerequisites.length !== entry.prerequisites.length
    ) {
      warnings.push(msg("importWarnPrerequisiteNotNumber", undefined, label));
    } else if (!Array.isArray(entry.prerequisites)) {
      warnings.push(msg("importWarnPrerequisitesMissing", undefined, label));
    }

    // A rhythm is kept only when it fits the counts beside it; the app never stores one that
    // does not, so anything else was edited by hand.
    const counts = typeof entry.counts === "number" ? entry.counts : 0;
    let rhythm: string | undefined;
    if (entry.rhythm !== undefined) {
      if (
        typeof entry.rhythm === "string" &&
        rhythmMatchesCounts(entry.rhythm, counts)
      ) {
        rhythm = normalizeRhythm(entry.rhythm);
      } else {
        warnings.push(msg("importWarnRhythmMismatch", undefined, label));
      }
    }

    firstPass.push({
      id: entry.id,
      name: asString(entry.name, ""),
      typeId,
      counts,
      ...(typeof entry.level === "string" && { level: entry.level }),
      ...(rhythm && { rhythm }),
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
        msg("importWarnPrerequisiteNotInFile", undefined, {
          list: where.list,
          pattern: pattern.name,
        }),
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
  errors: ImportMessage[],
  warnings: ImportMessage[],
): PatternListWithPatterns | null {
  if (!isObject(raw)) {
    errors.push(msg("importErrorListNotObject", { index: index + 1 }));
    return null;
  }
  if (!isNonEmptyString(raw.id)) {
    errors.push(msg("importErrorListNoId", { index: index + 1 }));
    return null;
  }
  const label: ImportMessageContext = { list: asString(raw.name, raw.id) };

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
    // 3.4. Storage drops it again from a read-only copy.
    ...(isNonEmptyString(raw.shareKey) && { shareKey: raw.shareKey }),
    // A dance this build does not know only loses its suggestions.
    ...(isDance(raw.dance) && { dance: raw.dance }),
    patterns,
  };
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
