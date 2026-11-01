import { IPattern } from "@/src/pattern/types/IPatternList";
import { PatternType } from "@/src/pattern/types/PatternType";
import { BUILT_IN_LEVEL_IDS } from "@/src/pattern/types/PatternLevel";
import type { SortConfig, SortField } from "@/src/pattern/list/SortBottomSheet";

/**
 * Sorting the pattern list, and splitting it into sections.
 *
 * A sort by type, level or counts groups the list under a header per value, and a sort by date
 * added under a header per day; a sort by name stays one list, since a header per letter says
 * nothing. The date sort orders by id, which grows as patterns are added, so its days come in
 * order; patterns from before dates were kept (`IPattern.createdAt`) sit under their own header,
 * and a list with no dates at all stays one list. Types and levels follow the order the list
 * gives them (`IPatternList.levels`, easiest first), rather than by internal id or by spelling.
 * A pattern without a value (no level, a level or type the list no longer has) always goes last,
 * in a section of its own, whichever way the sort runs.
 */

/** The fields whose sort splits the list into sections. */
export function isSectionedSort(field: SortField): boolean {
  return (
    field === "typeId" ||
    field === "level" ||
    field === "counts" ||
    field === "id"
  );
}

/**
 * Where a pattern ranks on a field, or `undefined` when it has no value there. A value the list
 * does not have (a level from an older import, a deleted type) counts as none.
 */
function rank(
  pattern: IPattern,
  field: SortField,
  typeOrder: Map<string, number>,
  levelOrder: Map<string, number>,
): number | string | undefined {
  switch (field) {
    case "name":
      return pattern.name.toLowerCase();
    case "typeId":
      return typeOrder.get(pattern.typeId);
    case "level":
      return pattern.level ? levelOrder.get(pattern.level) : undefined;
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
  /** The list's levels in their order (`resolveLevelIds`). */
  levelIds: readonly string[] = BUILT_IN_LEVEL_IDS,
): IPattern[] {
  const typeOrder = new Map(patternTypes.map((type, i) => [type.id, i]));
  const levelOrder = new Map(levelIds.map((id, i) => [id, i]));
  const direction = order === "asc" ? 1 : -1;
  const byName = (a: IPattern, b: IPattern) =>
    a.name.toLowerCase().localeCompare(b.name.toLowerCase());

  return [...patterns].sort((a, b) => {
    const ra = rank(a, field, typeOrder, levelOrder);
    const rb = rank(b, field, typeOrder, levelOrder);
    if (ra === undefined || rb === undefined) {
      if (ra !== rb) return ra === undefined ? 1 : -1;
      return byName(a, b);
    }
    const primary = compareValues(ra, rb) * direction;
    if (primary !== 0) return primary;
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
  /** A level's name in the list, or undefined for one the list does not have (no level). */
  level: (levelId: string) => string | undefined;
  counts: (counts: number) => string;
  /** The day a timestamp falls on, as a header. */
  day: (timestamp: number) => string;
  noLevel: string;
  noType: string;
  noDate: string;
}

/** The local calendar day of a timestamp, as a key. */
function dayKey(timestamp: number): string {
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
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
    case "level": {
      const title = pattern.level ? labels.level(pattern.level) : undefined;
      return title !== undefined
        ? { key: `level:${pattern.level}`, title }
        : { key: "level:none", title: labels.noLevel };
    }
    case "id":
      return pattern.createdAt
        ? {
            key: `day:${dayKey(pattern.createdAt)}`,
            title: labels.day(pattern.createdAt),
          }
        : { key: "day:none", title: labels.noDate };
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
  if (field === "id" && !sorted.some((p) => p.createdAt)) return rows(sorted);

  const types = new Map(patternTypes.map((type) => [type.id, type]));
  const entries: PatternListEntry[] = [];
  let header: Extract<PatternListEntry, { kind: "section" }> | undefined;
  let runKey: string | undefined;
  const seen = new Set<string>();
  for (const pattern of sorted) {
    const section = sectionOf(pattern, field, types, labels);
    if (section.key !== runKey || !header) {
      runKey = section.key;
      // A day can come round twice when the phone's clock was wrong; the list needs unique keys.
      let key = section.key;
      for (let n = 2; seen.has(key); n++) key = `${section.key}#${n}`;
      seen.add(key);
      header = { kind: "section", count: 0, ...section, key };
      entries.push(header);
    }
    header.count += 1;
    entries.push(...rows([pattern]));
  }
  return entries;
}
