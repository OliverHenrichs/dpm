import { IPattern } from "@/src/pattern/types/IPatternList";

/*
 * Renaming, merging and deleting a list's tags in list settings. Tags are plain strings on the
 * figures, compared ignoring case as the tag picker does (`pickerOptions.ts`), so "Basic" and
 * "basic" are one tag. The edits are drafts until the list is saved, like `TypeMoves`.
 */

/**
 * What happens to each tag edited so far, keyed by the tag in lower case: the name it takes
 * (a new name, a new spelling, or another tag it merges into), or `null` when it is deleted.
 * A `Map`, not a record: a tag may be called "constructor".
 */
export type TagEdits = ReadonlyMap<string, string | null>;

export const NO_TAG_EDITS: TagEdits = new Map();

export const tagKey = (tag: string) => tag.toLowerCase();

export interface TagUsage {
  /** The tag as most figures spell it (the first seen on a tie). */
  tag: string;
  /** How many figures carry it. */
  count: number;
}

/** Every tag of `tagLists` (one entry per figure) with how many figures carry it, by name. */
export function countTags(
  tagLists: readonly (readonly string[])[],
): TagUsage[] {
  const byKey = new Map<
    string,
    { count: number; spellings: Map<string, number> }
  >();
  for (const tags of tagLists) {
    const seen = new Set<string>();
    for (const tag of tags) {
      const key = tagKey(tag);
      const entry = byKey.get(key) ?? { count: 0, spellings: new Map() };
      byKey.set(key, entry);
      entry.spellings.set(tag, (entry.spellings.get(tag) ?? 0) + 1);
      // A figure counts once, even if an old import gave it "Basic" and "basic".
      if (!seen.has(key)) entry.count++;
      seen.add(key);
    }
  }
  return [...byKey.values()]
    .map(({ count, spellings }) => {
      let tag = "";
      let best = 0;
      for (const [spelling, uses] of spellings) {
        if (uses > best) [tag, best] = [spelling, uses];
      }
      return { tag, count };
    })
    .sort((a, b) => a.tag.localeCompare(b.tag));
}

/**
 * `edits` with the tag `from` renamed to `to`, or deleted with `null`. Tags renamed or merged
 * into `from` earlier follow it, so merging Push into Pass and then renaming Pass to Whip ends
 * with both at Whip, and deleting Pass then deletes both.
 */
export function addTagEdit(
  edits: TagEdits,
  from: string,
  to: string | null,
): TagEdits {
  const fromKey = tagKey(from);
  const next = new Map<string, string | null>();
  for (const [source, target] of edits) {
    next.set(
      source,
      target !== null && tagKey(target) === fromKey ? to : target,
    );
  }
  // A tag of that name renamed away earlier keeps its own edit: `from` is now another tag that
  // took the free name, and the loop above has moved that one.
  if (!edits.has(fromKey)) next.set(fromKey, to);
  return next;
}

/**
 * One figure's tags with the edits applied, in the order they were: a renamed tag keeps its
 * place, and a merge keeps the first of the two (the more recent), so no tag is there twice.
 */
export function editTags(tags: readonly string[], edits: TagEdits): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const tag of tags) {
    const key = tagKey(tag);
    const edited = edits.has(key) ? edits.get(key)! : tag;
    if (edited === null) continue;
    const editedKey = tagKey(edited);
    if (seen.has(editedKey)) continue;
    seen.add(editedKey);
    result.push(edited);
  }
  return result;
}

/**
 * The patterns with the tag edits applied. The same array when no figure changes, so a save
 * without tag edits writes no patterns.
 */
export function applyTagEdits(
  patterns: IPattern[],
  edits: TagEdits,
): IPattern[] {
  if (edits.size === 0) return patterns;
  let changed = false;
  const next = patterns.map((pattern) => {
    const tags = editTags(pattern.tags, edits);
    const same =
      tags.length === pattern.tags.length &&
      tags.every((tag, i) => tag === pattern.tags[i]);
    if (same) return pattern;
    changed = true;
    return { ...pattern, tags };
  });
  return changed ? next : patterns;
}
