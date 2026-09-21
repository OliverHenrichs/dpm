/**
 * The storage key for a list's manual graph layout.
 *
 * Its own module, with no imports, because two places need it: the graph's
 * own storage helpers, and `PatternListStorage`, which must delete the key
 * when a list is deleted or all data is cleared. Reaching into
 * `GraphLayoutStorage` for it would pull the whole reconciliation layer into
 * every bundle that touches list storage, and duplicating the string is how a
 * key drifts and starts leaking rows.
 */
export const GRAPH_LAYOUT_KEY_PREFIX = "@graphLayout_";

export function getGraphLayoutKey(listId: string): string {
  return `${GRAPH_LAYOUT_KEY_PREFIX}${listId}`;
}
