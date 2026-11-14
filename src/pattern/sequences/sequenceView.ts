import type {
  IModifier,
  IPattern,
  ISequence,
} from "@/src/pattern/types/IPatternList";
import type { SortConfig } from "@/src/pattern/list/SortBottomSheet";
import type { Dance } from "@/src/pattern/types/Dance";
import { sequenceTotals } from "@/src/pattern/sequences/sequences";

/** What the Sequences segment sorts by. `added` is creation order, oldest first. */
export type SequenceSortField = "name" | "added" | "counts" | "steps";

export const DEFAULT_SEQUENCE_SORT: SortConfig<SequenceSortField> = {
  field: "added",
  order: "asc",
};

export interface SequenceFilter {
  name: string;
  /** Part of a figure's name: only sequences with a step of a matching figure. */
  figure: string;
  /** Only sequences with a video. */
  withVideo: boolean;
}

export const EMPTY_SEQUENCE_FILTER: SequenceFilter = {
  name: "",
  figure: "",
  withVideo: false,
};

export function filterSequences(
  sequences: ISequence[],
  filter: SequenceFilter,
  patterns: IPattern[],
): ISequence[] {
  const name = filter.name.trim().toLowerCase();
  const figure = filter.figure.trim().toLowerCase();
  const matchingFigures = figure
    ? new Set(
        patterns
          .filter((p) => p.name.toLowerCase().includes(figure))
          .map((p) => p.id),
      )
    : null;
  return sequences.filter(
    (sequence) =>
      (!name || sequence.name.toLowerCase().includes(name)) &&
      (!filter.withVideo || !!sequence.video) &&
      (!matchingFigures ||
        sequence.steps.some(
          (step) =>
            step.kind === "figure" && matchingFigures.has(step.patternId),
        )),
  );
}

/** How many of the filter's criteria are set: what the toolbar's _Filter_ chip counts. */
export function countSequenceFilters(filter: SequenceFilter): number {
  return [
    filter.name.trim() !== "",
    filter.figure.trim() !== "",
    filter.withVideo,
  ].filter(Boolean).length;
}

/**
 * Sorted copy. Total counts are the same totals the rows show (`sequenceTotals`). Ties keep
 * creation order.
 */
export function sortSequences(
  sequences: ISequence[],
  sort: SortConfig<SequenceSortField>,
  patterns: IPattern[],
  modifiers: IModifier[],
  dance?: Dance,
): ISequence[] {
  const dir = sort.order === "asc" ? 1 : -1;
  const byAdded = [...sequences].sort((a, b) => a.createdAt - b.createdAt);
  switch (sort.field) {
    case "name":
      return byAdded.sort(
        (a, b) =>
          dir *
          a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
      );
    case "added":
      return dir === 1 ? byAdded : byAdded.reverse();
    case "steps":
      return byAdded.sort((a, b) => dir * (a.steps.length - b.steps.length));
    case "counts": {
      const total = new Map(
        byAdded.map((s) => [
          s.id,
          sequenceTotals(s.steps, patterns, modifiers, dance).counts,
        ]),
      );
      return byAdded.sort(
        (a, b) => dir * (total.get(a.id)! - total.get(b.id)!),
      );
    }
  }
}
