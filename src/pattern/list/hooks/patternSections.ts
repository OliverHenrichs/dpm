import { IPattern } from "@/src/pattern/types/IPatternList";
import { PatternType } from "@/src/pattern/types/PatternType";
import { PatternLevel } from "@/src/pattern/types/PatternLevel";
import type { SortConfig, SortField } from "@/src/pattern/list/SortBottomSheet";

/**
 * Sorting the pattern list, and splitting it into sections.
 *
 * A sort by type, level or counts groups the list under a header per value; a sort by name or
 * by date added stays one list, since a header per letter or per day says nothing. Types
 * follow the order the list gives them and levels run beginner to advanced, rather than by
 * internal id or by the spelling of the level. A pattern without a value (no level, a type the
 * list no longer has) always goes last, in a section of its own, whichever way the sort runs.
 */

const LEVEL_ORDER: string[] = Object.values(PatternLevel);

/** The fields whose sort splits the list into sections. */
export function isSectionedSort(field: SortField): boolean {
  return field === "typeId" || field === "level" || field === "counts";
}

/**
 * Where a pattern ranks on a field, or `undefined` when it has no value there. Values the app
 * does not know (an older list's level, a deleted type) rank after the known ones, by spelling.
 */
function rank(
  pattern: IPattern,
  field: SortField,
  typeOrder: Map<string, number>,
): number | string | undefined {
  switch (field) {
    case "name":
      return pattern.name.toLowerCase();
    case "typeId":
      return typeOrder.get(pattern.typeId);
    case "level": {
      if (!pattern.level) return undefined;
      const index = LEVEL_ORDER.indexOf(pattern.level);
      return index >= 0 ? index : LEVEL_ORDER.length;
    }
    case "counts":
      return typeof pattern.counts === "number" ? pattern.counts : undefined;
    case "id":
      return pattern.id;
  }
}

function compareValues(a: number | string, b: number | string): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b));
}

export function sortPatterns(
  patterns: IPattern[],
  { field, order }: SortConfig,
  patternTypes: PatternType[] = [],
): IPattern[] {
  const typeOrder = new Map(patternTypes.map((type, i) => [type.id, i]));
  const direction = order === "asc" ? 1 : -1;
  const byName = (a: IPattern, b: IPattern) =>
    a.name.toLowerCase().localeCompare(b.name.toLowerCase());

  return [...patterns].sort((a, b) => {
    const ra = rank(a, field, typeOrder);
    const rb = rank(b, field, typeOrder);
    if (ra === undefined || rb === undefined) {
      if (ra !== rb) return ra === undefined ? 1 : -1;
      return byName(a, b);
    }
    const primary = compareValues(ra, rb) * direction;
    if (primary !== 0) return primary;
    // An unknown level ranks with the other unknowns; its spelling orders it among them.
    if (field === "level" && a.level !== b.level) {
      return compareValues(a.level ?? "", b.level ?? "") * direction;
    }
    // Inside a section, patterns read alphabetically whichever way the sections run.
    return field === "name" ? 0 : byName(a, b);
  });
}

export type PatternListEntry =
  | {
      kind: "section";
      key: string;
      title: string;
      count: number;
      /** The type's colour, for a section of one type. */
      color?: string;
    }
  | { kind: "pattern"; key: string; pattern: IPattern };

/** The words a section header needs, so this file stays free of i18n. */
export interface SectionLabels {
  level: (level: string) => string;
  counts: (counts: number) => string;
  noLevel: string;
  noType: string;
}

function sectionOf(
  pattern: IPattern,
  field: SortField,
  types: Map<string, PatternType>,
  labels: SectionLabels,
): { key: string; title: string; color?: string } {
  switch (field) {
    case "typeId": {
      const type = types.get(pattern.typeId);
      return type
        ? { key: `type:${type.id}`, title: type.slug, color: type.color }
        : { key: "type:none", title: labels.noType };
    }
    case "level":
      return pattern.level
        ? { key: `level:${pattern.level}`, title: labels.level(pattern.level) }
        : { key: "level:none", title: labels.noLevel };
    default:
      return {
        key: `counts:${pattern.counts}`,
        title: labels.counts(pattern.counts),
      };
  }
}

/**
 * The rows a sorted list renders: the patterns themselves, with a header before each run of
 * patterns sharing a value when the sort is one that sections. Expects `sortPatterns` output,
 * whose runs are contiguous.
 */
export function buildListEntries(
  sorted: IPattern[],
  field: SortField,
  patternTypes: PatternType[],
  labels: SectionLabels,
): PatternListEntry[] {
  const rows = (patterns: IPattern[]): PatternListEntry[] =>
    patterns.map((pattern) => ({
      kind: "pattern",
      key: String(pattern.id),
      pattern,
    }));
  if (!isSectionedSort(field)) return rows(sorted);

  const types = new Map(patternTypes.map((type) => [type.id, type]));
  const entries: PatternListEntry[] = [];
  let header: Extract<PatternListEntry, { kind: "section" }> | undefined;
  for (const pattern of sorted) {
    const section = sectionOf(pattern, field, types, labels);
    if (section.key !== header?.key) {
      header = { kind: "section", count: 0, ...section };
      entries.push(header);
    }
    header.count += 1;
    entries.push(...rows([pattern]));
  }
  return entries;
}
