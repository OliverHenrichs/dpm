import { IPattern } from "@/src/pattern/types/IPatternList";
import { fuzzyFilter } from "@/src/common/utils/fuzzyMatch";

/*
 * The order of the options in the pattern editor's tag and prerequisite pickers. What the
 * pattern has comes first, most recently chosen first (choosing prepends). The rest follow by
 * how often the other patterns of the list use them, then by name, and a search narrows them
 * fuzzily, best match first. What the pattern has always stays in view, whatever the search.
 */

const sameTag = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

const byUsageThenName =
  <T>(usage: (item: T) => number, name: (item: T) => string) =>
  (a: T, b: T) =>
    usage(b) - usage(a) || name(a).localeCompare(name(b));

/** `tags` with `tag` put first, unless it is blank or the pattern has it already (any case). */
export function prependTag(tags: string[], tag: string): string[] {
  const trimmed = tag.trim();
  if (!trimmed || tags.some((t) => sameTag(t, trimmed))) return tags;
  return [trimmed, ...tags];
}

export interface TagOptions {
  /** The tags not chosen, most used first, narrowed by the search. */
  options: string[];
  /** The search, trimmed, when no tag of the list or the pattern is called that (any case). */
  creatable: string | null;
}

/**
 * The tags `chosen` could add: every tag of the list's other patterns (`patterns` without the
 * one being edited, `editingId`), spelled as it is most often.
 */
export function tagOptions(
  patterns: IPattern[],
  chosen: string[],
  query: string,
  editingId?: number,
): TagOptions {
  // Keyed by lower case, so "Basic" and "basic" are one tag.
  const usage = new Map<string, { tag: string; count: number }>();
  for (const pattern of patterns) {
    if (pattern.id === editingId) continue;
    for (const tag of pattern.tags) {
      const key = tag.toLowerCase();
      const entry = usage.get(key);
      if (entry) entry.count++;
      else usage.set(key, { tag, count: 1 });
    }
  }
  const unchosen = [...usage.values()]
    .filter(({ tag }) => !chosen.some((c) => sameTag(c, tag)))
    .sort(
      byUsageThenName(
        (e) => e.count,
        (e) => e.tag,
      ),
    )
    .map((e) => e.tag);

  const trimmed = query.trim();
  const exists =
    usage.has(trimmed.toLowerCase()) || chosen.some((c) => sameTag(c, trimmed));
  return {
    options: fuzzyFilter(unchosen, trimmed, (tag) => tag),
    creatable: trimmed && !exists ? trimmed : null,
  };
}

/**
 * The patterns that could become prerequisites: the ones not chosen, most often a prerequisite
 * of another pattern first, narrowed by the search. Those that `ineligible` names (they would
 * close a loop) go last, since they cannot be picked anyway.
 */
export function prerequisiteOptions(
  patterns: IPattern[],
  chosen: number[],
  query: string,
  ineligible: ReadonlySet<number>,
  editingId?: number,
): IPattern[] {
  const usage = new Map<number, number>();
  for (const pattern of patterns) {
    if (pattern.id === editingId) continue;
    for (const id of pattern.prerequisites) {
      usage.set(id, (usage.get(id) ?? 0) + 1);
    }
  }
  const unchosen = patterns
    .filter((p) => !chosen.includes(p.id))
    .sort(
      (a, b) =>
        Number(ineligible.has(a.id)) - Number(ineligible.has(b.id)) ||
        byUsageThenName<IPattern>(
          (p) => usage.get(p.id) ?? 0,
          (p) => p.name,
        )(a, b),
    );
  return fuzzyFilter(unchosen, query, (p) => p.name);
}
