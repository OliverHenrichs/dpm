import type { IModifier } from "@/src/pattern/types/IPatternList";
import type { SortConfig } from "@/src/pattern/list/SortBottomSheet";

/** What the Modifiers segment sorts by. `added` is the list's own order, oldest first. */
export type ModifierSortField = "name" | "position" | "added";

export const DEFAULT_MODIFIER_SORT: SortConfig<ModifierSortField> = {
  field: "added",
  order: "asc",
};

export type ModifierKind = "universal" | "attached";

export interface ModifierFilter {
  name: string;
  /** Empty: every position. */
  positions: IModifier["position"][];
  /** Empty: both kinds. */
  kinds: ModifierKind[];
}

export const EMPTY_MODIFIER_FILTER: ModifierFilter = {
  name: "",
  positions: [],
  kinds: [],
};

/** Positions in dancing order: Entry, During, Exit. */
export const MODIFIER_POSITIONS: IModifier["position"][] = [
  "prefix",
  "amends",
  "postfix",
];

export const kindOf = (modifier: IModifier): ModifierKind =>
  modifier.universal ? "universal" : "attached";

export function filterModifiers(
  modifiers: IModifier[],
  filter: ModifierFilter,
): IModifier[] {
  const name = filter.name.trim().toLowerCase();
  return modifiers.filter(
    (modifier) =>
      (!name || modifier.name.toLowerCase().includes(name)) &&
      (filter.positions.length === 0 ||
        filter.positions.includes(modifier.position)) &&
      (filter.kinds.length === 0 || filter.kinds.includes(kindOf(modifier))),
  );
}

/** How many of the filter's criteria are set: what the toolbar's _Filter_ chip counts. */
export function countModifierFilters(filter: ModifierFilter): number {
  return [
    filter.name.trim() !== "",
    filter.positions.length > 0,
    filter.kinds.length > 0,
  ].filter(Boolean).length;
}

const byName = (a: IModifier, b: IModifier) =>
  a.name.localeCompare(b.name, undefined, { sensitivity: "base" });

/**
 * Sorted copy. By position the positions keep dancing order, flipped when descending, with
 * names ascending inside each; by date added it is the list's order, or that order reversed.
 */
export function sortModifiers(
  modifiers: IModifier[],
  sort: SortConfig<ModifierSortField>,
): IModifier[] {
  const dir = sort.order === "asc" ? 1 : -1;
  const sorted = [...modifiers];
  switch (sort.field) {
    case "name":
      return sorted.sort((a, b) => dir * byName(a, b));
    case "position":
      return sorted.sort(
        (a, b) =>
          dir *
            (MODIFIER_POSITIONS.indexOf(a.position) -
              MODIFIER_POSITIONS.indexOf(b.position)) || byName(a, b),
      );
    case "added":
      return dir === 1 ? sorted : sorted.reverse();
  }
}

export type ModifierListEntry =
  | {
      kind: "section";
      key: string;
      position: IModifier["position"];
      count: number;
    }
  | { kind: "modifier"; key: string; modifier: IModifier };

/**
 * Rows for the Modifiers segment: sorted by position, each position gets a header with its
 * count, as the figures' sorts by type or level do; the other sorts are one list.
 */
export function buildModifierEntries(
  sorted: IModifier[],
  field: ModifierSortField,
): ModifierListEntry[] {
  const rows = (list: IModifier[]): ModifierListEntry[] =>
    list.map((modifier) => ({
      kind: "modifier",
      key: modifier.id,
      modifier,
    }));
  if (field !== "position") return rows(sorted);
  const entries: ModifierListEntry[] = [];
  let current: IModifier["position"] | undefined;
  for (const modifier of sorted) {
    if (modifier.position !== current) {
      current = modifier.position;
      entries.push({
        kind: "section",
        key: `section-${modifier.position}`,
        position: modifier.position,
        count: sorted.filter((m) => m.position === modifier.position).length,
      });
    }
    entries.push(...rows([modifier]));
  }
  return entries;
}

/** The i18n key of a position's name: Entry, During or Exit. */
export const modifierPositionKey = (position: IModifier["position"]) =>
  position === "prefix"
    ? "modifierPositionPrefix"
    : position === "postfix"
      ? "modifierPositionPostfix"
      : "modifierPositionAmends";
