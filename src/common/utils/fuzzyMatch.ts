/** Lower case, without accents, so "Écart" is found by typing "ecart". */
const fold = (text: string) =>
  text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/**
 * How well `query` matches `text`, lower being better, or `null` for no match.
 *
 * Ranked in tiers: the whole text, then a prefix, then the start of a later word, then anywhere
 * inside it, and last the query's letters in order with gaps between them ("sgpsh" finds "Sugar
 * Push"), the fewer gaps the better. Case, accents and spaces in the query do not matter for
 * that last tier. An empty query matches everything equally.
 */
export function fuzzyScore(text: string, query: string): number | null {
  const q = fold(query).trim();
  if (!q) return 0;
  const target = fold(text);
  if (target === q) return 0;
  if (target.startsWith(q)) return 1;
  const at = target.indexOf(q);
  if (at > 0 && /[\s\-_/]/.test(target[at - 1])) return 2;
  if (at > 0) return 3;

  const letters = q.replace(/\s+/g, "");
  let gaps = 0;
  let from = 0;
  for (let i = 0; i < letters.length; i++) {
    const found = target.indexOf(letters[i], from);
    if (found < 0) return null;
    if (i > 0 && found > from) gaps++;
    from = found + 1;
  }
  return 4 + gaps;
}

/**
 * The items that match `query`, best match first. Items that match equally well keep the order
 * they came in, so a list already sorted by something else stays sorted within each tier.
 */
export function fuzzyFilter<T>(
  items: readonly T[],
  query: string,
  textOf: (item: T) => string,
): T[] {
  return items
    .map((item, index) => ({
      item,
      index,
      score: fuzzyScore(textOf(item), query),
    }))
    .filter((entry) => entry.score !== null)
    .sort((a, b) => a.score! - b.score! || a.index - b.index)
    .map((entry) => entry.item);
}
